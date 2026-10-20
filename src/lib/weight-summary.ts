/**
 * Pure arithmetic for the dashboard's weight card.
 *
 * `@/lib/daily-metrics` keeps the queries and the Prisma/Decimal conversion; this
 * module only subtracts, so the sign conventions and float-noise rounding can be
 * tested without a database or `server-only`.
 */

/**
 * Weights are `Decimal(5, 2)`, so two decimals is the full stored precision.
 * Rounding the differences removes binary float noise (`79.8 - 75` is
 * `4.800000000000001` in JS) without discarding any real value.
 */
function roundKg(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * `deltaKg` is `latest - goal` (positive means ABOVE goal) and `change7dKg` is
 * `latest - baseline`. Either side missing is `null`, never 0 and never NaN.
 */
export function summarizeWeight(input: {
  latest: { date: string; weightKg: number } | null;
  goalKg: number | null;
  baseline: { date: string; weightKg: number } | null;
}): { deltaKg: number | null; change7dKg: number | null } {
  const { latest, goalKg, baseline } = input;

  if (latest === null) {
    return { deltaKg: null, change7dKg: null };
  }

  return {
    deltaKg: goalKg === null ? null : roundKg(latest.weightKg - goalKg),
    change7dKg:
      baseline === null ? null : roundKg(latest.weightKg - baseline.weightKg),
  };
}
