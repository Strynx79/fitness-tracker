import { isoDateRange } from "@/lib/date";

/**
 * Pure weight-trend series building.
 *
 * Extracted from `@/lib/daily-metrics` so it can be unit-tested with plain
 * `node --test`: the read model imports `server-only` and Prisma, neither of
 * which resolves in a non-react-server Node process.
 */

/** One point on the weight trend chart. */
export type WeightPoint = {
  date: string; // "YYYY-MM-DD"
  weightKg: number | null; // null for days with no weigh-in
};

/**
 * Left-joins `history` against every day in the range, ascending.
 *
 * Days with no row (or a row with a null weight) become `{ weightKg: null }` so
 * the chart keeps a contiguous, evenly spaced x-axis instead of collapsing the
 * gaps and implying weigh-ins the user never did.
 */
export function buildWeightSeries(
  history: Array<{ date: string; weightKg: number | null }>,
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
