import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { deriveExerciseKey, escapeLikePattern, resolvePage } from "@/lib/exercise";

/**
 * Read model for the global exercise catalog (prisma/data/exercises.json).
 *
 * The catalog is shared by every user and read-only at runtime, so nothing here
 * takes a `userId`. Everything returned is JSON-safe: the table holds no
 * `Decimal` and no timestamp that the UI needs, so these DTOs are plain strings
 * and string arrays.
 *
 * `muscleGroup` is nullable in the schema even though the vendored dataset
 * currently fills every row — keeping the null in the type means a partial
 * import cannot silently become `"null"` in a template literal.
 */

/** One row of the library grid. */
export type ExerciseSummary = {
  datasetId: string;
  name: string;
  equipment: string;
  bodyPart: string;
  target: string;
  muscleGroup: string | null;
  /** Dataset-relative thumbnail path, e.g. `images/0025-EIeI8Vf.jpg`. */
  imagePath: string | null;
};

/** One exercise, as its detail page renders it. */
export type ExerciseDetail = ExerciseSummary & {
  id: string;
  category: string;
  /** Dataset-relative animation path, e.g. `videos/0025-EIeI8Vf.gif`. */
  gifPath: string | null;
  secondaryMuscles: string[];
  instructionsEn: string;
  stepsEn: string[];
  attribution: string;
  youtubeUrl: string | null;
};

/**
 * Search input, as the page receives it.
 *
 * These fields arrive from raw `searchParams`, so they are treated as untrusted
 * even though the type names them narrowly: the normalizers below reject arrays,
 * non-finite numbers and empty strings rather than letting them reach Prisma.
 */
export type ExerciseSearchParams = {
  q?: string;
  bodyPart?: string;
  equipment?: string;
  page?: number;
};

export type ExerciseSearchResult = {
  items: ExerciseSummary[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Exported so the pagination controls and the tests agree with the query:
 * a UI that assumed a different page size would compute different page links
 * than the server actually returns.
 */
export const EXERCISES_PAGE_SIZE = 24;

/** Longest `q` that can still match a `nameKey` (`VARCHAR(120)`). */
const MAX_QUERY_CHARS = 80;

/** `datasetId` is a 4-char dataset id (`VARCHAR(8)` leaves room to grow). */
const MAX_DATASET_ID_CHARS = 8;

/**
 * Trim and bound a raw filter value.
 *
 * Returns `undefined` for anything that is not a usable string, which the
 * callers turn into "no filter". Slicing (rather than rejecting) an over-long
 * `q` is deliberate: a pasted paragraph is a user typing, not an attack, and an
 * unbounded `contains` would still scan the index harmlessly — but keeping the
 * value bounded makes the query plan predictable.
 */
function normalizeFilter(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  return trimmed.slice(0, maxChars);
}

/** Accept a number, or a numeric string that slipped through from `searchParams`. */
function normalizePage(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

const SUMMARY_SELECT = {
  datasetId: true,
  name: true,
  equipment: true,
  bodyPart: true,
  target: true,
  muscleGroup: true,
  imagePath: true,
} satisfies Prisma.ExerciseSelect;

/**
 * One page of the catalog, optionally filtered by text and two facets.
 *
 * `q` matches `nameKey`, which is already `deriveExerciseKey`-normalized, so
 * `contains` is a plain case-sensitive match on lowercase text — `mode:
 * "insensitive"` would only add a function call per row. The query is
 * normalized with the same helper instead of `toLowerCase()` so a typed
 * "Bench   Press" (collapsed runs) still matches the stored key.
 *
 * Ordering is `name asc, id asc`: name alone is not unique in a 1.3k-row
 * dataset, and an unstable tie-break lets a row appear on two pages (or none)
 * as Postgres re-plans. `id` (cuid, non-null) makes the order total.
 *
 * Two round trips, count first: the clamp needs `total` before `skip` can be
 * computed. `Promise.all` would fire the page query with an unclamped skip, and
 * a `$transaction` cannot feed the count back into the second query.
 */
export async function searchExercises(
  params: ExerciseSearchParams = {},
): Promise<ExerciseSearchResult> {
  const where: Prisma.ExerciseWhereInput = {};

  const query = normalizeFilter(params.q, MAX_QUERY_CHARS);
  if (query !== undefined) {
    where.nameKey = { contains: escapeLikePattern(deriveExerciseKey(query)) };
  }

  // Facet values are stored lowercase in the dataset, so the raw searchParam is
  // lowercased too — otherwise `?bodyPart=Chest` would silently match nothing.
  const bodyPart = normalizeFilter(params.bodyPart, 40);
  if (bodyPart !== undefined) {
    where.bodyPart = bodyPart.toLowerCase();
  }

  const equipment = normalizeFilter(params.equipment, 40);
  if (equipment !== undefined) {
    where.equipment = equipment.toLowerCase();
  }

  const total = await prisma.exercise.count({ where });

  const { page, pageCount } = resolvePage(
    normalizePage(params.page),
    total,
    EXERCISES_PAGE_SIZE,
  );

  const items = await prisma.exercise.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * EXERCISES_PAGE_SIZE,
    take: EXERCISES_PAGE_SIZE,
    select: SUMMARY_SELECT,
  });

  return { items, total, page, pageCount };
}

/**
 * One catalog exercise by dataset id, or `null`.
 *
 * A well-formed but unknown id is `null` — the page turns that into `notFound()`
 * and does not leak whether the id ever existed. Absurdly long ids are rejected
 * before the query rather than truncated: truncating could match a *different*
 * exercise, which is worse than not finding one.
 */
export async function getExercise(datasetId: string): Promise<ExerciseDetail | null> {
  if (typeof datasetId !== "string") return null;

  const id = datasetId.trim();
  if (id.length === 0 || id.length > MAX_DATASET_ID_CHARS) return null;

  const row = await prisma.exercise.findUnique({
    where: { datasetId: id },
    select: {
      id: true,
      datasetId: true,
      name: true,
      category: true,
      bodyPart: true,
      equipment: true,
      target: true,
      muscleGroup: true,
      imagePath: true,
      gifPath: true,
      secondaryMuscles: true,
      instructionsEn: true,
      stepsEn: true,
      attribution: true,
      youtubeUrl: true,
    },
  });

  return row;
}

/**
 * Distinct facet values for the filter selects.
 *
 * Two `groupBy` queries instead of one `findMany({ distinct })`: each one scans
 * a single indexed column (`exercises_body_part_idx` / `exercises_equipment_idx`)
 * and returns ~10 / ~28 rows, so the cost is a pair of small index scans over
 * 1,324 rows. `Promise.all` keeps them in one round trip. If the catalog ever
 * grows or these lists become user-editable, promote this to a cached query
 * rather than a per-request one.
 */
export async function getExerciseFacets(): Promise<{
  bodyParts: string[];
  equipment: string[];
}> {
  const [bodyPartRows, equipmentRows] = await Promise.all([
    prisma.exercise.groupBy({
      by: ["bodyPart"],
      orderBy: { bodyPart: "asc" },
    }),
    prisma.exercise.groupBy({
      by: ["equipment"],
      orderBy: { equipment: "asc" },
    }),
  ]);

  return {
    bodyParts: bodyPartRows.map((row) => row.bodyPart),
    equipment: equipmentRows.map((row) => row.equipment),
  };
}
