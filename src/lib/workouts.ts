import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { parseIsoDate, toIsoDate } from "@/lib/date";
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
  /** Calendar date (YYYY-MM-DD) when the workout is planned; `null` if not. */
  scheduledForIso: string | null;
  /** `null` means the session is still in progress. */
  completedAtIso: string | null;
  setCount: number;
  /** Distinct exercise names, in order of the session's blocks. */
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

/**
 * One exercise block inside a session — the card the logging screen renders.
 *
 * A block exists even with zero sets, which is the whole point of the table: you
 * add "Bench press", then fill the sets in as the workout happens.
 */
export type WorkoutExerciseBlock = {
  /** `WorkoutExercise.id` — what the add-set form posts. */
  id: string;
  exerciseKey: string;
  /** Display name as first typed/picked in THIS session (may differ in case). */
  exerciseName: string;
  /** Internal catalog id when picked from the library, else `null`. */
  exerciseId: string | null;
  /** Dataset id (e.g. "0025") for linking to `/exercises/[datasetId]`. */
  datasetId: string | null;
  /** Display order within the session. */
  position: number;
  /** Ordered by `setNumber` ascending. */
  sets: WorkoutSetDto[];
  previousTopSet: PreviousTopSet | null;
};

export type WorkoutSessionDetail = {
  id: string;
  name: string;
  notes: string | null;
  startedAtIso: string;
  /** Calendar date (YYYY-MM-DD) when planned; `null` if not scheduled. */
  scheduledForIso: string | null;
  completedAtIso: string | null;
  isCompleted: boolean;
  blocks: WorkoutExerciseBlock[];
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
  // Query 1 — the session, its exercise blocks, and each block's sets. Ordering
  // is `position` (the order the user added them) and then `createdAt` as a
  // stable tie-break for blocks that share a position after an import.
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      name: true,
      notes: true,
      startedAt: true,
      scheduledFor: true,
      completedAt: true,
      exercises: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          nameKey: true,
          position: true,
          exerciseId: true,
          exercise: { select: { datasetId: true } },
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
            orderBy: [{ setNumber: "asc" }],
          },
        },
      },
    },
  });

  // Not found and not owned are the same answer, on purpose.
  if (session === null) return null;

  // Blocks are returned in position order, sets in setNumber order. An empty
  // block (zero sets) is a real, renderable card — that is what "add an exercise
  // and fill it in as you go" means.
  const blocks: WorkoutExerciseBlock[] = session.exercises.map((block) => ({
    id: block.id,
    exerciseKey: block.nameKey,
    exerciseName: block.name,
    exerciseId: block.exerciseId,
    datasetId: block.exercise?.datasetId ?? null,
    position: block.position,
    sets: block.sets.map(toSetDto),
    previousTopSet: null,
  }));

  const exerciseKeys = blocks.map((block) => block.exerciseKey);

  if (exerciseKeys.length > 0) {
    // Query 2 — every set these exercises appear in, across the user's other
    // COMPLETED sessions in the window, newest session first.
    //
    // One `IN (...)` instead of an N+1 ("for each exercise, fetch its history");
    // the newest-first order means the first session encountered per key is
    // already the right one.
    //
    // Deliberately excluded:
    //   - in-progress sessions (`completedAt: null`) — their sets are not
    //     history, and an abandoned session must never become a target
    //   - this session itself, so re-rendering after logging a set still shows
    //     the PREVIOUS session rather than the set just typed
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
      // timestamp, and mixing them would attribute the wrong name/date.
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

    for (const block of blocks) {
      block.previousTopSet = bestByKey.get(block.exerciseKey) ?? null;
    }
  }

  return {
    id: session.id,
    name: session.name,
    notes: session.notes,
    startedAtIso: session.startedAt.toISOString(),
    // `DATE` columns come back as UTC midnight, which is what `toIsoDate` reads.
    scheduledForIso:
      session.scheduledFor === null ? null : toIsoDate(session.scheduledFor),
    completedAtIso: session.completedAt === null ? null : session.completedAt.toISOString(),
    isCompleted: session.completedAt !== null,
    blocks,
  };
}

export async function getWorkoutSessionList(
  userId: string,
  today: string,
): Promise<WorkoutSessionSummary[]> {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      // Planned workouts live in the "Upcoming" list, not in history. Without
      // this a session scheduled for Saturday would sit at the top of "History"
      // looking like something that already happened.
      NOT: { scheduledFor: { gt: parseIsoDate(today) } },
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      name: true,
      startedAt: true,
      scheduledFor: true,
      completedAt: true,
      // Blocks carry the exercise names (including ones with no sets yet), and
      // their position is the order the session was built in.
      exercises: {
        select: { name: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { sets: true } },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    name: session.name,
    startedAtIso: session.startedAt.toISOString(),
    scheduledForIso:
      session.scheduledFor === null ? null : toIsoDate(session.scheduledFor),
    completedAtIso:
      session.completedAt === null ? null : session.completedAt.toISOString(),
    setCount: session._count.sets,
    exerciseNames: session.exercises.map((exercise) => exercise.name),
  }));
}

/**
 * The newest session that is actually under way.
 *
 * "Under way" excludes anything scheduled for a future date: a workout planned
 * for Saturday must not be treated as the session you are logging into today,
 * or the library's "Log in …" button would target the wrong workout.
 *
 * Nothing forbids several open sessions, so "newest by startedAt" is the one a
 * user who just tapped "start a workout" means; `id` breaks exact ties
 * deterministically, the same way `getLastCompletedWorkout` does.
 */
export async function getInProgressSession(
  userId: string,
  today: string,
): Promise<{ id: string; name: string } | null> {
  return prisma.workoutSession.findFirst({
    where: {
      userId,
      completedAt: null,
      // A scheduled date in the future is not "in progress" yet.
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: parseIsoDate(today) } }],
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true },
  });
}

/** One planned workout, for the "Upcoming" list on the workouts page. */
export type UpcomingWorkoutSummary = {
  id: string;
  name: string;
  /** Calendar date (YYYY-MM-DD); always present for an upcoming workout. */
  scheduledForIso: string;
  /** Exercise blocks already added, in order. */
  exerciseNames: string[];
};

/**
 * Planned workouts dated after `today`, soonest first.
 *
 * Only blocks matter here — a scheduled workout normally has no sets yet, so
 * this deliberately does not read `workout_sets` at all.
 */
export async function getUpcomingWorkouts(
  userId: string,
  today: string,
): Promise<UpcomingWorkoutSummary[]> {
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId,
      completedAt: null,
      scheduledFor: { gt: parseIsoDate(today) },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      scheduledFor: true,
      exercises: {
        select: { name: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  // The `gt` filter guarantees a date, but the column is nullable in the schema.
  return rows.flatMap((row) =>
    row.scheduledFor === null
      ? []
      : [
          {
            id: row.id,
            name: row.name,
            scheduledForIso: toIsoDate(row.scheduledFor),
            exerciseNames: row.exercises.map((exercise) => exercise.name),
          },
        ],
  );
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
