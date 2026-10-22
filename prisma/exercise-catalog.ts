import { readFileSync } from "node:fs";

import type { PrismaClient } from "../src/generated/prisma/client";
import { deriveExerciseKey } from "../src/lib/exercise";

// ---------------------------------------------------------------------------
// Exercise catalog — vendored dataset (global, shared by every user)
// ---------------------------------------------------------------------------

/** One record of prisma/data/exercises.json, as vendored. */
type ExerciseCatalogRecord = {
  id: string;
  name: string;
  category: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string | null;
  secondaryMuscles: string[];
  instructionsEn: string;
  stepsEn: string[];
  image: string;
  gifUrl: string;
  attribution: string;
};

/** The exact column set the seeder writes; also the shape it compares against. */
type ExerciseRow = {
  datasetId: string;
  name: string;
  nameKey: string;
  category: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string | null;
  secondaryMuscles: string[];
  instructionsEn: string;
  stepsEn: string[];
  imagePath: string | null;
  gifPath: string | null;
  attribution: string;
};

/**
 * 200 keeps each `INSERT ... ON CONFLICT DO NOTHING` well under Postgres's
 * 65,535 bind-parameter limit (13 columns × 200 = 2,600) while turning 1,324
 * rows into 7 round trips instead of 1,324.
 */
const CATALOG_BATCH_SIZE = 200;

/**
 * Build the write shape from a dataset record.
 *
 * `nameKey` comes from the same `deriveExerciseKey` the server action uses for
 * `WorkoutSet.exerciseKey`, so a library pick and a hand-typed "Bench  Press"
 * resolve to one exercise and the progressive-overload history keeps matching.
 */
function toExerciseRow(record: ExerciseCatalogRecord): ExerciseRow {
  return {
    datasetId: record.id,
    name: record.name,
    nameKey: deriveExerciseKey(record.name),
    category: record.category,
    bodyPart: record.bodyPart,
    equipment: record.equipment,
    target: record.target,
    muscleGroup: record.muscleGroup ?? null,
    secondaryMuscles: record.secondaryMuscles ?? [],
    instructionsEn: record.instructionsEn,
    stepsEn: record.stepsEn,
    imagePath: record.image,
    gifPath: record.gifUrl,
    attribution: record.attribution,
  };
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, i) => value === right[i]);
}

/** Whether a stored row still equals the vendored record. */
function sameExerciseRow(stored: ExerciseRow, desired: ExerciseRow): boolean {
  return (
    stored.name === desired.name &&
    stored.nameKey === desired.nameKey &&
    stored.category === desired.category &&
    stored.bodyPart === desired.bodyPart &&
    stored.equipment === desired.equipment &&
    stored.target === desired.target &&
    stored.muscleGroup === desired.muscleGroup &&
    sameStringArray(stored.secondaryMuscles, desired.secondaryMuscles) &&
    stored.instructionsEn === desired.instructionsEn &&
    sameStringArray(stored.stepsEn, desired.stepsEn) &&
    stored.imagePath === desired.imagePath &&
    stored.gifPath === desired.gifPath &&
    stored.attribution === desired.attribution
  );
}

/**
 * Idempotent catalog import, chosen for the fewest queries per re-run.
 *
 * Strategy: batched `createMany({ skipDuplicates: true })` to fill the table,
 * then ONE `findMany` to diff the stored rows against the dataset in JS, then
 * `update` only the rows that actually drifted.
 *
 * Why not `upsert` per row: that is 1,324 statements on every run even when
 * nothing changed, and it bumps `updatedAt` on every row every seed. Why not a
 * blind `updateMany` after inserting: same problem — every row would look
 * modified, which destroys `updatedAt` as a signal of "the dataset changed".
 * With this shape, a no-op re-run costs 7 inserts (all skipped) + 1 select.
 *
 * Nothing here deletes: a dataset id that disappears from the JSON stays in the
 * table, so a user's `WorkoutSet.exerciseId` can never dangle. `WorkoutSet` rows
 * are never touched, and `exerciseId` is left NULL for the seeded fixtures,
 * which predate the catalog (they carry free-text exercise names).
 */
export async function seedExerciseCatalog(
  prisma: PrismaClient,
): Promise<{
  inserted: number;
  updated: number;
  total: number;
}> {
  // Resolved from this script, not `process.cwd()`: `prisma db seed` and a
  // direct `tsx prisma/seed.ts` run from different directories, and a cwd-based
  // path would only work for one of them.
  const raw = readFileSync(new URL("./data/exercises.json", import.meta.url), "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("prisma/data/exercises.json must contain a JSON array.");
  }
  if (parsed.length === 0) {
    throw new Error(
      "prisma/data/exercises.json is empty — refusing to seed an empty catalog.",
    );
  }

  // The file is vendored and version-controlled, so the array/empty guard above
  // is the useful check; per-field validation would only duplicate the
  // VARCHAR limits the migration already enforces.
  const records = parsed as ExerciseCatalogRecord[];
  const rows = records.map(toExerciseRow);

  const before = await prisma.exercise.count();

  for (let start = 0; start < rows.length; start += CATALOG_BATCH_SIZE) {
    await prisma.exercise.createMany({
      data: rows.slice(start, start + CATALOG_BATCH_SIZE),
      skipDuplicates: true,
    });
  }

  const afterInsert = await prisma.exercise.count();
  const inserted = afterInsert - before;

  // One read of the (small) table, then a pure in-memory diff.
  const stored = await prisma.exercise.findMany({
    select: {
      datasetId: true,
      name: true,
      nameKey: true,
      category: true,
      bodyPart: true,
      equipment: true,
      target: true,
      muscleGroup: true,
      secondaryMuscles: true,
      instructionsEn: true,
      stepsEn: true,
      imagePath: true,
      gifPath: true,
      attribution: true,
    },
  });

  const desiredByDatasetId = new Map(rows.map((row) => [row.datasetId, row]));
  const updates: Array<{ datasetId: string; data: ExerciseRow }> = [];

  for (const row of stored) {
    const desired = desiredByDatasetId.get(row.datasetId);
    if (desired === undefined) continue; // dataset row removed upstream; keep it
    if (sameExerciseRow(row, desired)) continue;
    updates.push({ datasetId: row.datasetId, data: desired });
  }

  // Only drifted rows are rewritten, in bounded transactions so one bad row
  // cannot leave the catalog half-updated across hundreds of statements.
  for (let start = 0; start < updates.length; start += CATALOG_BATCH_SIZE) {
    const batch = updates.slice(start, start + CATALOG_BATCH_SIZE);
    await prisma.$transaction(
      batch.map((entry) =>
        prisma.exercise.update({
          where: { datasetId: entry.datasetId },
          data: entry.data,
        }),
      ),
    );
  }

  const total = await prisma.exercise.count();

  return { inserted, updated: updates.length, total };
}
