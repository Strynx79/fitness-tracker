import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { pickTopSet } from "@/lib/exercise";

/**
 * Read model for Slice 3 — a workout session and its logged sets.
 *
 * Like `@/lib/daily-metrics` and `@/lib/habits`, everything leaving this module
 * is JSON-safe: `Date` becomes an ISO 8601 instant string and Prisma's `Decimal`
 * becomes a plain `number`. A `Decimal` handed to a Client Component throws,
 * and a `Date` costs the UI a re-serialization it cannot do consistently.
 */

/** One set, as the logging screen renders it. */
export type WorkoutSetDto = {
  id: string;
  exerciseName: string;
  exerciseKey: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
};

/** One row of the history list. */
export type WorkoutSessionSummary = {
  id: string;
  name: string;
  /** ISO 8601 instant — NOT a calendar date; this column is `timestamptz`. */
  startedAtIso: string;
  /** `null` means the session is still in progress. */
  completedAtIso: string | null;
  setCount: number;
  /** Distinct exercise names, in order of first appearance in the session. */
  exerciseNames: string[];
};

/**
 * The "beat this" target shown next to an exercise: the top set of the most
 * recent earlier *completed* session that trained it.
 */
export type PreviousTopSet = {
  exerciseKey: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  sessionName: string;
  /** That session's `startedAt`, as an ISO 8601 instant. */
  performedAtIso: string;
};

/** The dashboard's "last workout" card. */
export type LastWorkoutSummary = {
  id: string;
  name: string;
  /** ISO 8601 instant; this session is completed by definition. */
  completedAtIso: string;
  /** `completedAt - startedAt`, rounded to whole minutes and clamped at 0. */
  durationMinutes: number;
  setCount: number;
  /** Sum of `weightKg * reps` over every set; bodyweight sets add 0. */
  totalVolumeKg: number;
  /** Distinct display names, in order of first appearance in the session. */
  exerciseNames: string[];
};

export type WorkoutExerciseGroup = {
  exerciseKey: string;
  /** Display name as first typed in THIS session (may differ in case). */
  exerciseName: string;
  /** Ordered by `setNumber` ascending. */
  sets: WorkoutSetDto[];
  previousTopSet: PreviousTopSet | null;
};

export type WorkoutSessionDetail = {
  id: string;
  name: string;
  notes: string | null;
  startedAtIso: string;
  completedAtIso: string | null;
  isCompleted: boolean;
  groups: WorkoutExerciseGroup[];
};

/** The only place a Prisma `Decimal` is converted to a `number`. */
function toSetDto(row: {
  id: string;
  exerciseName: string;
  exerciseKey: string;
  setNumber: number;
  weightKg: Prisma.Decimal;
  reps: number;
  rpe: Prisma.Decimal | null;
}): WorkoutSetDto {
  return {
    id: row.id,
    exerciseName: row.exerciseName,
    exerciseKey: row.exerciseKey,
    setNumber: row.setNumber,
    weightKg: row.weightKg.toNumber(),
    reps: row.reps,
    // `null` is "left unrated", not zero — keep the distinction in the DTO.
    rpe: row.rpe === null ? null : row.rpe.toNumber(),
  };
}

const MS_PER_DAY = 86_400_000;

const MS_PER_MINUTE = 60_000;

/**
 * `Decimal(5, 2)` weights times integer reps stay within two decimals, so
 * rounding the sum removes binary float noise without losing precision.
 */
function roundVolume(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * How far back a "previous top set" is allowed to reach.
 *
 * A target from 18 months ago is not a useful thing to beat — the user's
 * strength and bodyweight have moved — and the bound also keeps the candidate
 * scan proportional to recent training rather than to lifetime history. One
 * year is long enough that a lift trained once a month still has a target.
 */
const PREVIOUS_TOP_SET_WINDOW_DAYS = 365;

/** Newest sets scanned to build the `<datalist>`; see `getExerciseSuggestions`. */
const SUGGESTION_SCAN_LIMIT = 300;

/** Distinct exercises returned to the datalist. */
const SUGGESTION_LIMIT = 50;

/**
 * One session with its sets and, per exercise, the previous session's top set.
 *
 * Returns `null` when the id does not exist OR belongs to another user — the
 * ownership predicate is part of the query (`id` + `userId`), so there is no
 * window in which a foreign session is read and then filtered in JS. The page
 * turns both cases into `notFound()`, which also avoids leaking existence.
 *
 * Exactly two queries, whatever the number of exercises or sets.
 */
export async function getWorkoutSession(
  userId: string,
  sessionId: string,
): Promise<WorkoutSessionDetail | null> {
  // Query 1 — the session and its sets. `createdAt` first so the grouping below
  // sees exercises in the order they were first logged (and so the display name
  // is the first one typed); `setNumber` breaks ties and keeps the ordering
  // stable when a fixture inserts everything in one millisecond.
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      name: true,
      notes: true,
      startedAt: true,
      completedAt: true,
      sets: {
        select: {
          id: true,
          exerciseName: true,
          exerciseKey: true,
          setNumber: true,
          weightKg: true,
          reps: true,
          rpe: true,
        },
        orderBy: [{ createdAt: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  // Not found and not owned are the same answer, on purpose.
  if (session === null) return null;

  // Grouped in insertion order. `Map` preserves it, so the UI sees exercises in
  // the order the user trained them.
  const groups = new Map<string, WorkoutExerciseGroup>();
  for (const set of session.sets) {
    const dto = toSetDto(set);
    const existing = groups.get(dto.exerciseKey);

    if (existing === undefined) {
      groups.set(dto.exerciseKey, {
        exerciseKey: dto.exerciseKey,
        exerciseName: dto.exerciseName,
        sets: [dto],
        previousTopSet: null,
      });
      continue;
    }

    existing.sets.push(dto);
  }

  // Sorted explicitly rather than relying on the query order: the contract is
  // "setNumber ascending", and a group's first-typed (`createdAt`) order can
  // differ from it once a set is deleted and re-logged.
  for (const group of groups.values()) {
    group.sets.sort((a, b) => a.setNumber - b.setNumber);
  }

  const exerciseKeys = Array.from(groups.keys());

  if (exerciseKeys.length > 0) {
    // Query 2 — every set these exercises appear in, across the user's other
    // COMPLETED sessions in the window, newest session first.
    //
    // This is the one query that makes the callout possible without an N+1
    // ("for each exercise, fetch its history"): one `IN (...)` is bounded by the
    // number of distinct exercises on this screen, and the newest-first order
    // means the first session encountered per key is already the right one.
    //
    // Deliberately excluded:
    //   - in-progress sessions (`completedAt: null`) — their sets are not
    //     history, and an abandoned session must never become a target
    //   - this session itself, so re-rendering after logging a set still shows
    //     the PREVIOUS session rather than the set just typed
    //
    // Upgrade path (not implemented): a PostgreSQL `DISTINCT ON (exercise_key)`
    // raw query pushes the per-exercise ranking into the database —
    //
    //   SELECT DISTINCT ON (ws.exercise_key)
    //          ws.exercise_key, ws.weight_kg, ws.reps, ws.rpe, ws.set_number,
    //          s.name, s.started_at
    //     FROM workout_sets ws
    //     JOIN workout_sessions s ON s.id = ws.session_id
    //    WHERE s.user_id = $1
    //      AND s.completed_at IS NOT NULL
    //      AND s.started_at >= now() - interval '12 months'
    //      AND s.id <> $2
    //      AND ws.exercise_key = ANY($3)
    //    ORDER BY ws.exercise_key, s.started_at DESC, ws.weight_kg DESC,
    //             ws.reps DESC, ws.set_number ASC;
    //
    // That is worth doing when the history is large enough for the JS reduce to
    // matter; it costs a hand-written row type and `$queryRaw`, which is why it
    // stays a note for now. Fewer queries is not the goal here — the current
    // shape is already two round trips.
    const windowStart = new Date(Date.now() - PREVIOUS_TOP_SET_WINDOW_DAYS * MS_PER_DAY);

    const candidates = await prisma.workoutSet.findMany({
      where: {
        exerciseKey: { in: exerciseKeys },
        sessionId: { not: sessionId },
        session: {
          userId,
          completedAt: { not: null },
          startedAt: { gte: windowStart },
        },
      },
      select: {
        exerciseKey: true,
        weightKg: true,
        reps: true,
        rpe: true,
        setNumber: true,
        session: { select: { id: true, name: true, startedAt: true } },
      },
      // Newest session first is what defines "previous". `setNumber` ascending
      // is only a determinism tiebreak; the ranking itself happens in JS below.
      orderBy: [{ session: { startedAt: "desc" } }, { setNumber: "asc" }],
    });

    /**
     * The scan is newest-session-first, so the first session seen per exercise is
     * the one whose top set becomes the target. Rows are grouped per exercise and
     * winning session here; `pickTopSet` (pure, unit-tested) does the ranking.
     *
     * RankedSet carries the session metadata alongside the three ranking fields,
     * so the winning row alone can be turned into a `PreviousTopSet`.
     */
    type RankedSet = {
      weightKg: number;
      reps: number;
      setNumber: number;
      rpe: number | null;
      sessionName: string;
      performedAtIso: string;
    };

    const newestSessionByKey = new Map<
      string,
      { sessionId: string; startedAtMs: number; sets: RankedSet[] }
    >();

    for (const row of candidates) {
      const startedAtMs = row.session.startedAt.getTime();
      const current = newestSessionByKey.get(row.exerciseKey);

      const rankedSet: RankedSet = {
        weightKg: row.weightKg.toNumber(),
        reps: row.reps,
        setNumber: row.setNumber,
        rpe: row.rpe === null ? null : row.rpe.toNumber(),
        sessionName: row.session.name,
        performedAtIso: row.session.startedAt.toISOString(),
      };

      // First row seen for this exercise, or a row from a strictly newer session:
      // start collecting that session's sets, even when the weight is a bodyweight
      // `0`.
      if (current === undefined || startedAtMs > current.startedAtMs) {
        newestSessionByKey.set(row.exerciseKey, {
          sessionId: row.session.id,
          startedAtMs,
          sets: [rankedSet],
        });
        continue;
      }

      // A different session — older, or the same instant but a different row —
      // can never contribute to the newest session's top set. Sessions are
      // identified by `id`, never `startedAt`: two distinct sessions can share a
      // timestamp (batch imports, tests, a clock with millisecond resolution), and
      // mixing them would attribute the wrong name/date to the target.
      if (row.session.id !== current.sessionId) continue;

      current.sets.push(rankedSet);
    }

    const bestByKey = new Map<string, PreviousTopSet>();

    for (const [exerciseKey, entry] of newestSessionByKey) {
      // Heaviest wins, then most reps, then the lowest set number. A stored `0` is
      // a real weight (bodyweight) and ranks last only because it is the lightest.
      const topSet = pickTopSet(entry.sets);
      if (topSet === null) continue;

      bestByKey.set(exerciseKey, {
        exerciseKey,
        weightKg: topSet.weightKg,
        reps: topSet.reps,
        rpe: topSet.rpe,
        sessionName: topSet.sessionName,
        performedAtIso: topSet.performedAtIso,
      });
    }

    for (const group of groups.values()) {
      group.previousTopSet = bestByKey.get(group.exerciseKey) ?? null;
    }
  }

  return {
    id: session.id,
    name: session.name,
    notes: session.notes,
    startedAtIso: session.startedAt.toISOString(),
    completedAtIso: session.completedAt === null ? null : session.completedAt.toISOString(),
    isCompleted: session.completedAt !== null,
    groups: Array.from(groups.values()),
  };
}

/**
 * The history list, newest first, in-progress sessions included.
 *
 * One query: the per-session `sets` include is bounded by the sessions actually
 * returned, so it is not an N+1 — a per-session `count` or `findMany` in a loop
 * would be. `setCount` comes from the same rows, so no second aggregate is
 * needed; only the two exercise columns are selected to keep the payload small.
 *
 * Exercises are deduped on `exerciseKey`, matching the detail page's grouping:
 * a session containing "Bench Press" and "bench press" is one exercise, and the
 * summary keeps the first display name typed for that key.
 */
export async function getWorkoutSessionList(
  userId: string,
): Promise<WorkoutSessionSummary[]> {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      name: true,
      startedAt: true,
      completedAt: true,
      sets: {
        select: { exerciseName: true, exerciseKey: true },
        // First appearance order, so the summary names exercises the way the
        // session opened rather than alphabetically.
        orderBy: [{ createdAt: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  return sessions.map((session) => {
    const seenKeys = new Set<string>();
    const exerciseNames: string[] = [];

    for (const set of session.sets) {
      if (seenKeys.has(set.exerciseKey)) continue;
      seenKeys.add(set.exerciseKey);
      exerciseNames.push(set.exerciseName);
    }

    return {
      id: session.id,
      name: session.name,
      startedAtIso: session.startedAt.toISOString(),
      completedAtIso:
        session.completedAt === null ? null : session.completedAt.toISOString(),
      setCount: session.sets.length,
      exerciseNames,
    };
  });
}

/**
 * The most recent COMPLETED session, summarised for the dashboard.
 *
 * `completedAt: { not: null }` is load-bearing: an in-progress session is the
 * newest row by `startedAt`, so ordering on that (or dropping the filter) would
 * present a workout the user is still doing as finished history. The
 * `@@index([userId, completedAt])` serves this filter + sort directly.
 *
 * One query, with the sets included in the same round trip — a per-session
 * count/aggregate afterwards would be an N+1. `createdAt`, then `setNumber`,
 * fixes first-appearance order, matching `getWorkoutSessionList`, and dedupes on
 * `exerciseKey` so "Bench Press"/"bench press" appear once.
 */
export async function getLastCompletedWorkout(
  userId: string,
): Promise<LastWorkoutSummary | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { userId, completedAt: { not: null } },
    // `startedAt` then `id` make the result deterministic when two sessions
    // share a `completedAt` (seeded, imported, or batched data can do that to
    // the millisecond). `completedAt` alone would let Postgres return either.
    orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      startedAt: true,
      completedAt: true,
      sets: {
        select: {
          exerciseName: true,
          exerciseKey: true,
          weightKg: true,
          reps: true,
        },
        orderBy: [{ createdAt: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  // The WHERE excludes nulls, but the generated type is still `Date | null`.
  if (session === null || session.completedAt === null) return null;

  const seenKeys = new Set<string>();
  const exerciseNames: string[] = [];
  let volume = 0;

  for (const set of session.sets) {
    if (!seenKeys.has(set.exerciseKey)) {
      seenKeys.add(set.exerciseKey);
      exerciseNames.push(set.exerciseName);
    }

    // A bodyweight set stores `0`, so it contributes 0 — volume measures
    // external load, not the lifter's mass.
    volume += set.weightKg.toNumber() * set.reps;
  }

  // A clock skew or a hand-edited row must not render "-3 min ago".
  const durationMinutes = Math.max(
    0,
    Math.round(
      (session.completedAt.getTime() - session.startedAt.getTime()) / MS_PER_MINUTE,
    ),
  );

  return {
    id: session.id,
    name: session.name,
    completedAtIso: session.completedAt.toISOString(),
    durationMinutes,
    setCount: session.sets.length,
    totalVolumeKg: roundVolume(volume),
    exerciseNames,
  };
}

/**
 * Distinct exercises the user has logged before, for the `<datalist>`.
 *
 * Deduped by `exerciseKey`, so "Bench Press" typed on Monday and "bench press"
 * typed on Friday produce one suggestion. The display name comes from the most
 * recent session that used the key, which is the spelling the user last chose.
 *
 * Newest-first ordering means the scan can stop at the first `SUGGESTION_LIMIT`
 * keys; `SUGGESTION_SCAN_LIMIT` caps the rows read to the most recent handful of
 * sessions so an account with years of history does not scan the whole table for
 * a type-ahead. In-progress sessions are included: the exercise the user logged
 * five minutes ago is exactly the one they are about to type again.
 */
export async function getExerciseSuggestions(
  userId: string,
): Promise<Array<{ exerciseName: string; exerciseKey: string }>> {
  const rows = await prisma.workoutSet.findMany({
    where: { session: { userId } },
    orderBy: [{ session: { startedAt: "desc" } }, { createdAt: "asc" }],
    take: SUGGESTION_SCAN_LIMIT,
    select: { exerciseName: true, exerciseKey: true },
  });

  const seen = new Set<string>();
  const suggestions: Array<{ exerciseName: string; exerciseKey: string }> = [];

  for (const row of rows) {
    if (seen.has(row.exerciseKey)) continue;
    seen.add(row.exerciseKey);
    suggestions.push({ exerciseName: row.exerciseName, exerciseKey: row.exerciseKey });
    if (suggestions.length >= SUGGESTION_LIMIT) break;
  }

  return suggestions;
}
