import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  escapeLikePattern,
  rankExerciseMatches,
  resolvePage,
  searchTokens,
} from "@/lib/exercise";

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
 * TEXT SEARCH IS TOKEN-AND, NOT SUBSTRING. The query is split into words and
 * every word must appear somewhere in `nameKey`, in any order. A plain
 * `contains "<whole query>"` was the earlier behaviour and it could never match
 * "incline dumbbell press" against the stored "dumbbell incline press", which is
 * exactly how people type it.
 *
 * Because all tokens must match, matching rows are ranked in JS — exact name,
 * then prefix, then phrase-on-a-word-boundary, then the rest — and paged from the
 * ranked list. That is affordable because the catalog is ~1.3k rows; the
 * no-query path still pages in SQL so ordinary browsing never reads the table.
 *
 * Filters (`bodyPart`, `equipment`) are applied in SQL in both paths. Facet
 * values are stored lowercase, so they are lowercased before matching.
 */
export async function searchExercises(
  params: ExerciseSearchParams = {},
): Promise<ExerciseSearchResult> {
  const where: Prisma.ExerciseWhereInput = {};

  const query = normalizeFilter(params.q, MAX_QUERY_CHARS);
  const tokens = query === undefined ? [] : searchTokens(query);

  if (tokens.length > 0) {
    // One `AND` entry per token: every word has to appear, order-independent.
    where.AND = tokens.map((token) => ({
      nameKey: { contains: escapeLikePattern(token) },
    }));
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

  if (tokens.length > 0) {
    // Read the matches, rank them, then slice. Bounded by the catalog size, and
    // only on the path where a query was actually typed.
    const rows = await prisma.exercise.findMany({
      where,
      select: { ...SUMMARY_SELECT, nameKey: true },
    });

    const ranked = rankExerciseMatches(rows, query ?? "");
    const { page, pageCount } = resolvePage(
      normalizePage(params.page),
      ranked.length,
      EXERCISES_PAGE_SIZE,
    );

    const start = (page - 1) * EXERCISES_PAGE_SIZE;

    const items: ExerciseSummary[] = ranked
      .slice(start, start + EXERCISES_PAGE_SIZE)
      .map((row) => ({
        datasetId: row.datasetId,
        name: row.name,
        equipment: row.equipment,
        bodyPart: row.bodyPart,
        target: row.target,
        muscleGroup: row.muscleGroup,
        imagePath: row.imagePath,
      }));

    return { items, total: ranked.length, page, pageCount };
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
 * One facet value with the number of catalog rows behind it.
 *
 * The count is what turns the filter list into a ledger: the library's shape is
 * visible before a single search, and every figure is computed from the same
 * table the results come from.
 */
export type ExerciseFacet = {
  value: string;
  count: number;
};

/** A facet group and the size of the set it is counting within. */
export type ExerciseFacetGroup = {
  options: ExerciseFacet[];
  /** Rows matching the *other* active filters — what the group's "All" row shows. */
  total: number;
};

/**
 * Facet values and their counts, scoped to the current search.
 *
 * The counts have to agree with the results header, so each group is counted
 * against the other filters but not against itself: with `?q=bench&equipment=dumbbell`
 * the body-part counts answer "how many bench exercises per body part with
 * dumbbells", and the equipment counts still let the reader switch equipment
 * without the list collapsing to the one already chosen. Counting the groups
 * catalog-wide instead would let the rail say "Chest 163" above a header
 * reading "1–8 of 8", which costs more trust than a missing figure.
 *
 * The text filter is the same token-AND `searchExercises` applies. It matters:
 * the ranked path matches "incline dumbbell press" against a stored
 * "dumbbell incline press", so an old substring filter here would report zero
 * for every body part while the list below returned rows.
 *
 * Two `groupBy` queries rather than one `findMany({ distinct })`: each scans a
 * single indexed column (`exercises_body_part_idx` / `exercises_equipment_idx`)
 * over 1,324 rows. If the catalog ever grows, promote this to a cached query
 * rather than a per-request one.
 */
export async function getExerciseFacets(
  params: ExerciseSearchParams = {},
): Promise<{ bodyParts: ExerciseFacetGroup; equipment: ExerciseFacetGroup }> {
  // The same normalization `searchExercises` applies, so the rail and the list
  // can never disagree about what the query means.
  const query = normalizeFilter(params.q, MAX_QUERY_CHARS);
  const tokens = query === undefined ? [] : searchTokens(query);
  const textWhere: Prisma.ExerciseWhereInput =
    tokens.length === 0
      ? {}
      : {
          AND: tokens.map((token) => ({
            nameKey: { contains: escapeLikePattern(token) },
          })),
        };

  const bodyPart = normalizeFilter(params.bodyPart, 40);
  const equipment = normalizeFilter(params.equipment, 40);

  const [bodyPartRows, equipmentRows] = await Promise.all([
    prisma.exercise.groupBy({
      by: ["bodyPart"],
      _count: { _all: true },
      where: {
        ...textWhere,
        ...(equipment === undefined ? {} : { equipment: equipment.toLowerCase() }),
      },
      orderBy: { bodyPart: "asc" },
    }),
    prisma.exercise.groupBy({
      by: ["equipment"],
      _count: { _all: true },
      where: {
        ...textWhere,
        ...(bodyPart === undefined ? {} : { bodyPart: bodyPart.toLowerCase() }),
      },
      orderBy: { equipment: "asc" },
    }),
  ]);

  return {
    bodyParts: {
      options: bodyPartRows.map((row) => ({
        value: row.bodyPart,
        count: row._count._all,
      })),
      total: bodyPartRows.reduce((sum, row) => sum + row._count._all, 0),
    },
    equipment: {
      options: equipmentRows.map((row) => ({
        value: row.equipment,
        count: row._count._all,
      })),
      total: equipmentRows.reduce((sum, row) => sum + row._count._all, 0),
    },
  };
}
