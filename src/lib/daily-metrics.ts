import "server-only";

import type { DailyMetric as DailyMetricRow } from "@/generated/prisma/client";
import { addDays, parseIsoDate, toIsoDate } from "@/lib/date";
import { prisma } from "@/lib/db";
import { summarizeWeight } from "@/lib/weight-summary";

// Re-exported from the pure module so existing callers keep their import path.
export { buildWeightSeries } from "@/lib/weight-series";
export type { WeightPoint } from "@/lib/weight-series";

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

/** Headline numbers for the dashboard's weight card. */
export type WeightSummary = {
  /** The newest actual weigh-in, or `null` when the user never weighed in. */
  latest: { date: string; weightKg: number } | null; // date is "YYYY-MM-DD"
  /** The user's target, or `null` when they have not set one. */
  goalKg: number | null;
  /** `latest.weightKg - goalKg`; positive means ABOVE goal. */
  deltaKg: number | null;
  /** `latest.weightKg - baseline`; negative means weight is trending down. */
  change7dKg: number | null;
  /** The weigh-in used as the 7-day baseline, so the UI can label the span honestly. */
  baseline: { date: string; weightKg: number } | null;
};

/**
 * Weights are `Decimal(5, 2)`; the subtraction and its two-decimal rounding live
 * in `@/lib/weight-summary`, which is pure and unit-tested.
 */

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
 * The dashboard's weight card: latest weigh-in, distance from goal, and the
 * change against a reading at least a week older.
 *
 * The `weightKg IS NOT NULL` filter is the whole point of the nullable column:
 * a day where the user logged macros but skipped the scale must never become
 * "your latest weight". Reading the newest row and hoping its weight is present
 * would show yesterday's number — or, worse, a null card after a macro-only day.
 *
 * At most three queries, all served by `@@unique([userId, date])`:
 *   1. the user's goal (bounded by the primary key)
 *   2. the newest non-null weigh-in
 *   3. the baseline for the 7-day change (skipped when there is no latest)
 */
export async function getWeightSummary(userId: string): Promise<WeightSummary> {
  // Queries 1 and 2 are independent; the goal does not depend on the weigh-in.
  const [user, latestRow] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { goalWeightKg: true },
    }),
    prisma.dailyMetric.findFirst({
      where: { userId, weightKg: { not: null } },
      orderBy: { date: "desc" },
      select: { date: true, weightKg: true },
    }),
  ]);

  const goalKg =
    user === null || user.goalWeightKg === null ? null : user.goalWeightKg.toNumber();

  // The WHERE guarantees a non-null weight, but the generated type is still
  // `Decimal | null`. Treat that as "no weigh-in" rather than asserting.
  if (latestRow === null || latestRow.weightKg === null) {
    return {
      latest: null,
      goalKg,
      deltaKg: null,
      change7dKg: null,
      baseline: null,
    };
  }

  const latestDate = toIsoDate(latestRow.date);
  const latestWeightKg = latestRow.weightKg.toNumber();

  // The boundary is "latest date minus 7 days". The baseline is the newest
  // reading on or before that boundary, NOT the row exactly on it: a user who
  // skipped the scale on day 7 still deserves a trend, and the closest earlier
  // reading is the honest comparison.
  const baselineBoundaryIso = addDays(latestDate, -7);

  // Query 3 — one row, thanks to the (userId, date) index plus the sort.
  const baselineRow = await prisma.dailyMetric.findFirst({
    where: {
      userId,
      weightKg: { not: null },
      date: { lte: parseIsoDate(baselineBoundaryIso) },
    },
    orderBy: { date: "desc" },
    select: { date: true, weightKg: true },
  });

  // The baseline row is surfaced as-is (date AND weight) rather than reduced to
  // its weight: because it is "on or before" the boundary, it can be much older
  // than 7 days, and the UI can only say so if it knows the date.
  const baseline =
    baselineRow === null || baselineRow.weightKg === null
      ? null
      : {
          date: toIsoDate(baselineRow.date),
          weightKg: baselineRow.weightKg.toNumber(),
        };

  const latest = { date: latestDate, weightKg: latestWeightKg };

  return {
    latest,
    goalKg,
    // Missing goal, weigh-in or baseline is `null`, never 0 and never NaN. The
    // pure module also rounds to two decimals so float noise cannot leak.
    ...summarizeWeight({ latest, goalKg, baseline }),
    baseline,
  };
}
