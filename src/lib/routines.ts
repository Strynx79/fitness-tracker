import "server-only";

import { prisma } from "@/lib/db";

/**
 * Read model for routines — the reusable plan behind a workout.
 *
 * A routine is not a session: starting it COPIES its exercises into a new
 * `WorkoutSession`, so editing the plan later never rewrites workouts that
 * already happened.
 */

export type RoutineExerciseDto = {
  id: string;
  name: string;
  nameKey: string;
  /** Internal catalog id when picked from the library, else `null`. */
  exerciseId: string | null;
  /** Dataset id (e.g. "0025") for linking to `/exercises/[datasetId]`. */
  datasetId: string | null;
  position: number;
  targetSets: number | null;
};

export type RoutineSummary = {
  id: string;
  name: string;
  /** 0 = Sunday … 6 = Saturday. Empty = unscheduled template. */
  weekdays: number[];
  exerciseCount: number;
};

export type RoutineDetail = {
  id: string;
  name: string;
  notes: string | null;
  weekdays: number[];
  exercises: RoutineExerciseDto[];
};

/** Every live routine, in the order the user arranged them. */
export async function getRoutines(userId: string): Promise<RoutineSummary[]> {
  const rows = await prisma.routine.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      weekdays: true,
      _count: { select: { exercises: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weekdays: row.weekdays,
    exerciseCount: row._count.exercises,
  }));
}

/**
 * Live routines assigned to one weekday (0 = Sunday … 6 = Saturday).
 *
 * Same shape and ordering as `getRoutines`; the only extra predicate is the
 * scalar-list `has`, which asks Postgres "does this routine run on day N"
 * without fetching every routine and filtering in JS. Archived routines are
 * excluded here for the same reason they are in `getRoutines`: archiving hides
 * a plan without deleting the workouts it produced.
 */
export async function getRoutinesForWeekday(
  userId: string,
  weekday: number,
): Promise<RoutineSummary[]> {
  const rows = await prisma.routine.findMany({
    where: { userId, archivedAt: null, weekdays: { has: weekday } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      weekdays: true,
      _count: { select: { exercises: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weekdays: row.weekdays,
    exerciseCount: row._count.exercises,
  }));
}

/** One routine with its ordered exercises, or `null` if missing/not owned. */
export async function getRoutine(
  userId: string,
  routineId: string,
): Promise<RoutineDetail | null> {
  const row = await prisma.routine.findFirst({
    where: { id: routineId, userId, archivedAt: null },
    select: {
      id: true,
      name: true,
      notes: true,
      weekdays: true,
      exercises: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          nameKey: true,
          exerciseId: true,
          position: true,
          targetSets: true,
          exercise: { select: { datasetId: true } },
        },
      },
    },
  });

  if (row === null) return null;

  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    weekdays: row.weekdays,
    exercises: row.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      nameKey: exercise.nameKey,
      exerciseId: exercise.exerciseId,
      datasetId: exercise.exercise?.datasetId ?? null,
      position: exercise.position,
      targetSets: exercise.targetSets,
    })),
  };
}
