import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

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
 * Rank two sets from the SAME session.
 *
 * Heaviest `weightKg` wins, then most `reps`, then the lowest `setNumber` (which
 * only matters when two sets are literally identical in weight and reps, and
 * makes the answer deterministic rather than dependent on row order).
 *
 * `weightKg` is `NOT NULL` in the schema, which is load-bearing here: a nullable
 * column would make Postgres's `ORDER BY ... DESC` put a raw bodyweight set
 * (`NULL`) first under its default NULLS FIRST, and the "heaviest" set would
 * silently become the one with no weight. A stored `0` is a real value and ranks
 * last only because it is the lightest, which is correct.
 */
function ranksHigher(
  candidate: { weightKg: number; reps: number; setNumber: number },
  current: { weightKg: number; reps: number; setNumber: number },
): boolean {
  if (candidate.weightKg !== current.weightKg) {
    return candidate.weightKg > current.weightKg;
  }
  if (candidate.reps !== current.reps) return candidate.reps > current.reps;
  return candidate.setNumber < current.setNumber;
}

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

    const bestByKey = new Map<
      string,
      { topSet: PreviousTopSet; setNumber: number }
    >();
    // The winning session is identified by `id`, never by `startedAt`: two
    // distinct sessions can share a timestamp (batch imports, tests, a clock
    // with millisecond resolution), and treating them as one would mix their
    // sets and attribute the wrong name/date to the target.
    const bestSessionByKey = new Map<string, { id: string; startedAtMs: number }>();

    for (const row of candidates) {
      const startedAtMs = row.session.startedAt.getTime();
      const currentSession = bestSessionByKey.get(row.exerciseKey);
      const weightKg = row.weightKg.toNumber();

      const topSet: PreviousTopSet = {
        exerciseKey: row.exerciseKey,
        weightKg,
        reps: row.reps,
        rpe: row.rpe === null ? null : row.rpe.toNumber(),
        sessionName: row.session.name,
        performedAtIso: row.session.startedAt.toISOString(),
      };

      // First row seen for this exercise, or a row from a strictly newer
      // session: it becomes the target even when it is a bodyweight `0`.
      if (currentSession === undefined || startedAtMs > currentSession.startedAtMs) {
        bestByKey.set(row.exerciseKey, { topSet, setNumber: row.setNumber });
        bestSessionByKey.set(row.exerciseKey, {
          id: row.session.id,
          startedAtMs,
        });
        continue;
      }

      // A different session — older, or the same instant but a different row —
      // can never contribute to the newest session's top set.
      if (row.session.id !== currentSession.id) continue;

      // Same session: pick its top set.
      const current = bestByKey.get(row.exerciseKey);
      if (current === undefined) continue;
      if (
        ranksHigher(
          { weightKg, reps: row.reps, setNumber: row.setNumber },
          {
            weightKg: current.topSet.weightKg,
            reps: current.topSet.reps,
            setNumber: current.setNumber,
          },
        )
      ) {
        bestByKey.set(row.exerciseKey, { topSet, setNumber: row.setNumber });
      }
    }

    for (const group of groups.values()) {
      group.previousTopSet = bestByKey.get(group.exerciseKey)?.topSet ?? null;
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
