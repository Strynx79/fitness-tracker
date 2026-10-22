"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate, todayIso } from "@/lib/date";
import { prisma } from "@/lib/db";
import { capitalizeExerciseName, deriveExerciseKey } from "@/lib/exercise";
import {
  addRoutineExerciseSchema,
  createRoutineSchema,
  routineExerciseIdSchema,
  routineIdSchema,
  routineWeekdaysSchema,
} from "@/lib/validations/routine";

/**
 * Server actions for routines.
 *
 * Starting or scheduling a routine copies its exercises into a session, so the
 * plan stays editable without touching training history. Every write is scoped
 * by `userId`; a routine id that belongs to someone else is indistinguishable
 * from one that does not exist.
 */

export type RoutineActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "notes", string[]>>;
  values?: { name: string; notes: string };
};

export type RoutineMutationResult =
  | { ok: true; sessionId?: string }
  | { ok: false; message: string };

const ROUTINES_PATH = "/routines";

const GENERIC_FAILURE = "Something went wrong. Please try again.";

function routinePath(routineId: string): string {
  return `${ROUTINES_PATH}/${routineId}`;
}

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function firstValidationMessage<T>(error: z.ZodError<T>): string {
  const { fieldErrors, formErrors } = z.flattenError(error);
  for (const messages of Object.values(fieldErrors) as Array<string[] | undefined>) {
    if (messages !== undefined && messages.length > 0) return messages[0];
  }
  return formErrors[0] ?? GENERIC_FAILURE;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Create a routine and go straight to its editor. */
export async function createRoutine(
  prevState: RoutineActionState,
  formData: FormData,
): Promise<RoutineActionState> {
  const user = await getCurrentUser();

  const values = {
    name: readField(formData, "name"),
    notes: readField(formData, "notes"),
  };

  const parsed = createRoutineSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  let routineId: string;

  try {
    const highest = await prisma.routine.aggregate({
      where: { userId: user.id },
      _max: { position: true },
    });

    const routine = await prisma.routine.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        position: (highest._max.position ?? -1) + 1,
      },
      select: { id: true },
    });

    routineId = routine.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = "You already have a routine with that name.";
      return {
        status: "error",
        message,
        fieldErrors: { name: [message] },
        values,
      };
    }

    console.error("Failed to create routine:", error);
    return { status: "error", message: GENERIC_FAILURE, values };
  }

  revalidatePath(ROUTINES_PATH);
  revalidatePath("/workouts");

  // `redirect` throws, so it sits outside the try/catch: inside, the catch would
  // swallow the navigation and show a generic error instead.
  redirect(routinePath(routineId));
}

/** Replace the weekday schedule of a routine. */
export async function setRoutineWeekdays(
  routineId: string,
  weekdays: number[],
): Promise<RoutineMutationResult> {
  const parsedId = routineIdSchema.safeParse({ routineId });
  const parsedDays = routineWeekdaysSchema.safeParse({ weekdays });

  if (!parsedId.success) {
    return { ok: false, message: firstValidationMessage(parsedId.error) };
  }
  if (!parsedDays.success) {
    return { ok: false, message: firstValidationMessage(parsedDays.error) };
  }

  const user = await getCurrentUser();

  try {
    const updated = await prisma.routine.updateMany({
      where: { id: parsedId.data.routineId, userId: user.id, archivedAt: null },
      data: { weekdays: parsedDays.data.weekdays },
    });

    if (updated.count === 0) {
      return { ok: false, message: "Routine not found." };
    }
  } catch (error) {
    console.error("Failed to set routine weekdays:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  revalidatePath(ROUTINES_PATH);
  revalidatePath(routinePath(parsedId.data.routineId));
  revalidatePath("/workouts");

  return { ok: true };
}

/**
 * Add an exercise to a routine.
 *
 * Catalog picks take the catalog name (authoritative); a custom name is stored
 * as typed. Adding one that is already there focuses the existing row instead of
 * erroring, matching the session picker.
 */
export async function addRoutineExercise(input: {
  routineId: string;
  datasetId?: string | null;
  name?: string | null;
}): Promise<RoutineMutationResult> {
  const parsed = addRoutineExerciseSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const routine = await tx.routine.findFirst({
        where: { id: parsed.data.routineId, userId: user.id, archivedAt: null },
        select: { id: true },
      });

      if (routine === null) {
        return { kind: "error" as const, message: "Routine not found." };
      }

      let name: string;
      let exerciseId: string | null = null;

      if (parsed.data.datasetId != null) {
        const catalogExercise = await tx.exercise.findUnique({
          where: { datasetId: parsed.data.datasetId },
          select: { id: true, name: true },
        });

        if (catalogExercise === null) {
          return {
            kind: "error" as const,
            message: "That exercise is no longer in the library.",
          };
        }

        name = capitalizeExerciseName(catalogExercise.name);
        exerciseId = catalogExercise.id;
      } else {
        name = parsed.data.name ?? "";
      }

      const nameKey = deriveExerciseKey(name);

      const existing = await tx.routineExercise.findFirst({
        where: { routineId: routine.id, nameKey },
        select: { id: true },
      });

      if (existing !== null) {
        return { kind: "success" as const };
      }

      const highest = await tx.routineExercise.aggregate({
        where: { routineId: routine.id },
        _max: { position: true },
      });

      await tx.routineExercise.create({
        data: {
          routineId: routine.id,
          exerciseId,
          name,
          nameKey,
          position: (highest._max.position ?? -1) + 1,
        },
      });

      return { kind: "success" as const };
    });

    if (outcome.kind === "error") {
      return { ok: false, message: outcome.message };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Another tab added the same exercise; the outcome is already true.
      return { ok: true };
    }

    console.error("Failed to add routine exercise:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  revalidatePath(routinePath(parsed.data.routineId));
  revalidatePath(ROUTINES_PATH);

  return { ok: true };
}

/** Remove one exercise from a routine. Past sessions are unaffected. */
export async function deleteRoutineExercise(
  id: string,
): Promise<RoutineMutationResult> {
  const parsed = routineExerciseIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const row = await prisma.routineExercise.findFirst({
      where: { id: parsed.data.id, routine: { userId: user.id } },
      select: { routineId: true },
    });

    if (row === null) {
      return { ok: false, message: "Exercise not found." };
    }

    await prisma.routineExercise.deleteMany({
      where: { id: parsed.data.id, routineId: row.routineId },
    });

    revalidatePath(routinePath(row.routineId));
    revalidatePath(ROUTINES_PATH);
  } catch (error) {
    console.error("Failed to delete routine exercise:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}

/** Archive a routine. Sessions already started from it stay untouched. */
export async function deleteRoutine(
  routineId: string,
): Promise<RoutineMutationResult> {
  const parsed = routineIdSchema.safeParse({ routineId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const archived = await prisma.routine.updateMany({
      where: { id: parsed.data.routineId, userId: user.id, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    if (archived.count === 0) {
      return { ok: false, message: "Routine not found." };
    }
  } catch (error) {
    console.error("Failed to archive routine:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  revalidatePath(ROUTINES_PATH);
  revalidatePath("/workouts");

  return { ok: true };
}

/**
 * Copy a routine's exercises into a session.
 *
 * `skipDuplicates` covers the one collision that can happen: the target session
 * already has a block for the same exercise (starting a routine twice into a
 * scheduled workout, or the user added it by hand first).
 */
async function copyRoutineIntoSession(
  tx: Prisma.TransactionClient,
  routineId: string,
  sessionId: string,
): Promise<void> {
  const exercises = await tx.routineExercise.findMany({
    where: { routineId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { exerciseId: true, name: true, nameKey: true, position: true },
  });

  if (exercises.length === 0) return;

  await tx.workoutExercise.createMany({
    data: exercises.map((exercise) => ({
      sessionId,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      nameKey: exercise.nameKey,
      position: exercise.position,
    })),
    skipDuplicates: true,
  });
}

/** Start a routine now: a new in-progress session with its exercises copied in. */
export async function startRoutine(
  routineId: string,
): Promise<RoutineMutationResult> {
  const parsed = routineIdSchema.safeParse({ routineId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const routine = await prisma.routine.findFirst({
      where: { id: parsed.data.routineId, userId: user.id, archivedAt: null },
      select: { id: true, name: true },
    });

    if (routine === null) {
      return { ok: false, message: "Routine not found." };
    }

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.workoutSession.create({
        data: { userId: user.id, name: routine.name },
        select: { id: true },
      });

      await copyRoutineIntoSession(tx, routine.id, created.id);

      return created;
    });

    revalidatePath("/workouts");
    revalidatePath(`/workouts/${session.id}`);

    return { ok: true, sessionId: session.id };
  } catch (error) {
    console.error("Failed to start routine:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }
}

/**
 * Plan a routine for a future date.
 *
 * Reuses an existing scheduled session for that date so "Push on Saturday" plus
 * "Legs on Saturday" is one workout, not two.
 */
export async function scheduleRoutine(
  routineId: string,
  date: string,
): Promise<RoutineMutationResult> {
  const parsed = routineIdSchema.safeParse({ routineId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "Pick a valid date." };
  }

  const user = await getCurrentUser();
  const today = todayIso(user.timezone);

  if (date < today) {
    return { ok: false, message: "Pick today or a future date." };
  }

  try {
    const routine = await prisma.routine.findFirst({
      where: { id: parsed.data.routineId, userId: user.id, archivedAt: null },
      select: { id: true, name: true },
    });

    if (routine === null) {
      return { ok: false, message: "Routine not found." };
    }

    const scheduledFor = parseIsoDate(date);

    const session = await prisma.$transaction(async (tx) => {
      const existing = await tx.workoutSession.findFirst({
        where: { userId: user.id, completedAt: null, scheduledFor },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const target =
        existing ??
        (await tx.workoutSession.create({
          data: { userId: user.id, name: routine.name, scheduledFor },
          select: { id: true },
        }));

      await copyRoutineIntoSession(tx, routine.id, target.id);

      return target;
    });

    revalidatePath("/workouts");
    revalidatePath(`/workouts/${session.id}`);
    revalidatePath(routinePath(routine.id));

    return { ok: true, sessionId: session.id };
  } catch (error) {
    console.error("Failed to schedule routine:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }
}
