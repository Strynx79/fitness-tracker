import "server-only";

import type { DailyMetric as DailyMetricRow } from "@/generated/prisma/client";
import { isoDateRange, parseIsoDate, toIsoDate } from "@/lib/date";
import { prisma } from "@/lib/db";

/**
 * Read model for a day's metrics.
 *
 * Everything is already JSON-safe: `date` is a `YYYY-MM-DD` string and
 * `weightKg` is a plain number. Prisma's `Decimal` and `Date` never leave this
 * module — passing a `Decimal` to a Client Component would throw, and passing a
 * `Date` for a `date` column reintroduces the off-by-one-day timezone bug that
 * `@/lib/date` exists to prevent.
 */
export type DailyMetricDto = {
  date: string; // "YYYY-MM-DD"
  weightKg: number | null;
  calories: number | null;
  proteinG: number | null;
  notes: string | null;
};

/** One point on the weight trend chart. */
export type WeightPoint = {
  date: string; // "YYYY-MM-DD"
  weightKg: number | null; // null for days with no weigh-in
};

/** Just the columns `toDto` needs; satisfies both `select` results and full rows. */
type DailyMetricColumns = Pick<
  DailyMetricRow,
  "date" | "weightKg" | "calories" | "proteinG" | "notes"
>;

/** The only place a Prisma `Decimal` is converted to `number`. */
function toDto(row: DailyMetricColumns): DailyMetricDto {
  return {
    date: toIsoDate(row.date),
    weightKg: row.weightKg === null ? null : row.weightKg.toNumber(),
    calories: row.calories,
    proteinG: row.proteinG,
    notes: row.notes,
  };
}

/** One row for a specific day, or `null` when the user has not logged it. */
export async function getDailyMetric(
  userId: string,
  dateIso: string,
): Promise<DailyMetricDto | null> {
  const row = await prisma.dailyMetric.findUnique({
    where: { userId_date: { userId, date: parseIsoDate(dateIso) } },
    select: {
      date: true,
      weightKg: true,
      calories: true,
      proteinG: true,
      notes: true,
    },
  });

  return row === null ? null : toDto(row);
}

/** Rows with a date in `[startIso, endIso]`, newest first. */
export async function getDailyMetricHistory(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<DailyMetricDto[]> {
  const rows = await prisma.dailyMetric.findMany({
    where: {
      userId,
      // Both ends are parsed (and validated) into UTC-midnight instants, which
      // is exactly how the `date` column stores them. `lte` on the end keeps the
      // range inclusive without an off-by-one on the last day.
      date: { gte: parseIsoDate(startIso), lte: parseIsoDate(endIso) },
    },
    orderBy: { date: "desc" },
    select: {
      date: true,
      weightKg: true,
      calories: true,
      proteinG: true,
      notes: true,
    },
  });

  return rows.map(toDto);
}

/**
 * Left-joins `history` against every day in the range, ascending.
 *
 * Days with no row (or a row with a null weight) become `{ weightKg: null }` so
 * the chart keeps a contiguous, evenly spaced x-axis instead of collapsing the
 * gaps and implying weigh-ins the user never did.
 */
export function buildWeightSeries(
  history: DailyMetricDto[],
  startIso: string,
  endIso: string,
): WeightPoint[] {
  const weightByDate = new Map<string, number>();
  for (const row of history) {
    if (row.weightKg !== null) weightByDate.set(row.date, row.weightKg);
  }

  return isoDateRange(startIso, endIso).map((date) => ({
    date,
    weightKg: weightByDate.get(date) ?? null,
  }));
}
