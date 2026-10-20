/**
 * Pure exercise helpers.
 *
 * Kept free of `server-only` and Prisma so the canonicalisation and top-set
 * ranking rules can be unit-tested directly, and so `prisma/seed.ts` (a plain tsx
 * script) can reuse the exact same key derivation as the server action.
 */

/**
 * The canonical exercise key: trim → collapse internal whitespace → lowercase.
 *
 * The display name is stored alongside it exactly as typed, so the UI still shows
 * "Bench Press" and not "bench press", while "Bench Press", "bench  press" and
 * " BENCH PRESS " all resolve to one exercise. That is load-bearing for the
 * "beat your previous session" callout, whose history query is keyed on this.
 */
export function deriveExerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The top set of a group, without mutating the input.
 *
 * Heaviest `weightKg` wins, then most `reps`, then the lowest `setNumber` (which
 * only matters when two sets are literally identical in weight and reps, and
 * makes the answer deterministic rather than dependent on array order).
 *
 * `weightKg: 0` is a real value (bodyweight), not "missing": it must compete and
 * simply ranks last because it is the lightest. An empty array has no top set and
 * returns `null`.
 */
export function pickTopSet<T extends { weightKg: number; reps: number; setNumber: number }>(
  sets: readonly T[],
): T | null {
  let best: T | null = null;

  for (const candidate of sets) {
    if (best === null) {
      best = candidate;
      continue;
    }

    if (candidate.weightKg !== best.weightKg) {
      if (candidate.weightKg > best.weightKg) best = candidate;
      continue;
    }

    if (candidate.reps !== best.reps) {
      if (candidate.reps > best.reps) best = candidate;
      continue;
    }

    if (candidate.setNumber < best.setNumber) best = candidate;
  }

  return best;
}
