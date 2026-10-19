"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createSessionSchema,
  deleteSetSchema,
  discardSessionSchema,
  finishSessionSchema,
  logSetSchema,
  type WorkoutFieldErrors,
} from "@/lib/validations/workout";

export type WorkoutActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: WorkoutFieldErrors;
  // Echo back what the user typed so a form can re-render after a failed submit
  // without losing input. One shape serves both forms; unused fields are "".
  values?: {
    name: string;
    notes: string;
    exerciseName: string;
    weightKg: string;
    reps: string;
    rpe: string;
  };
};

/** Row actions are called directly from the client, so they return plain data. */
export type WorkoutMutationResult = { ok: true } | { ok: false; message: string };

const WORKOUTS_PATH = "/workouts";

const GENERIC_FAILURE = "Something went wrong. Please try again.";

function sessionPath(sessionId: string): string {
  return `${WORKOUTS_PATH}/${sessionId}`;
}

/** Read a `FormData` entry as a string; absent or non-string entries become "". */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** The blank shape of `WorkoutActionState["values"]`; spread to fill a subset. */
function blankValues(): {
  name: string;
  notes: string;
  exerciseName: string;
  weightKg: string;
  reps: string;
  rpe: string;
} {
  return { name: "", notes: "", exerciseName: "", weightKg: "", reps: "", rpe: "" };
}

/**
 * The first human-readable message from a failed parse.
 *
 * Every schema in `@/lib/validations/workout` supplies explicit copy, so
 * whatever surfaces here is already user-facing — never a Zod default like
 * "Too small: expected number to be >=1".
 */
function firstValidationMessage<T>(error: z.ZodError<T>): string {
  const { fieldErrors, formErrors } = z.flattenError(error);
  for (const messages of Object.values(fieldErrors) as Array<string[] | undefined>) {
    if (messages !== undefined && messages.length > 0) return messages[0];
  }
  return formErrors[0] ?? GENERIC_FAILURE;
}

/** True for a Postgres unique-constraint violation (SQLSTATE 23505). */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * The canonical exercise key: trim → collapse internal whitespace → lowercase.
 *
 * Derived HERE, from the already-validated (and trimmed) display name, rather
 * than in the schema: `exerciseKey` is a storage concern, not a form field. If
 * the client could submit the key it could disagree with the name it displayed,
 * and if the key were not derived "Bench Press" and "bench  press" would become
 * two different exercises — silently breaking the "beat your previous session"
 * callout, because the history query is keyed on `exerciseKey`.
 *
 * The display name is stored alongside it exactly as typed, so the UI still
 * shows "Bench Press" and not "bench press".
 */
function deriveExerciseKey(exerciseName: string): string {
  return exerciseName.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Start a workout.
 *
 * `completedAt` is left NULL: a new session is in progress by definition, and
 * only `finishSession` may close it. The user is sent straight to the logging
 * screen, because an empty session page is the only useful next step.
 */
export async function createSession(
  prevState: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  // Ownership is derived server-side, never taken from the form. A posted
  // `userId` field is ignored entirely.
  const user = await getCurrentUser();

  const values = {
    ...blankValues(),
    name: readField(formData, "name"),
    notes: readField(formData, "notes"),
  };

  const parsed = createSessionSchema.safeParse({ name: values.name, notes: values.notes });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  let sessionId: string;

  try {
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        // Trimmed by the schema; `notes` is `null` (not "") when left blank.
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
      },
      select: { id: true },
    });

    sessionId = session.id;
  } catch (error) {
    // Prisma errors can leak schema/connection details; log them server-side
    // and hand the client a generic message.
    console.error("Failed to create workout session:", error);
    return { status: "error", message: GENERIC_FAILURE, values };
  }

  revalidatePath(WORKOUTS_PATH);

  // `redirect` throws (it is not a return value), so it must sit outside the
  // try/catch — otherwise the catch would swallow the navigation and the user
  // would see a generic error instead of the new session. Nothing may run after
  // this line; the function is effectively `never` from here.
  redirect(sessionPath(sessionId));
}

/**
 * Log one set into an in-progress session.
 *
 * Every mutation on a session is serialized by a guarded `updateMany` on its
 * `workout_sessions` row at the start of the transaction. That UPDATE takes a
 * row-level lock which Postgres holds until commit, so a concurrent finish or
 * discard either wins outright or waits and then fails its `completedAt: null`
 * predicate — a set can never land in a session that just became history.
 *
 * Four things decide whether this is safe:
 *
 *   1. the session is re-checked against the current user (the form's id is
 *      untrusted input, like every other value in it)
 *   2. a COMPLETED session refuses writes — its history is the record the
 *      overload callout reads, so it must not change after the fact
 *   3. `setNumber` is computed from the database, never taken from the client:
 *      it is per (session, exercise) and backed by a unique constraint
 *      (the lock makes it sequential, the constraint remains the backstop)
 *   4. the unique violation that two concurrent submits can cause is reported as
 *      a retry, not as a crash
 */
export async function logSet(
  prevState: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  const user = await getCurrentUser();

  const sessionId = readField(formData, "sessionId");
  const values = {
    ...blankValues(),
    exerciseName: readField(formData, "exerciseName"),
    weightKg: readField(formData, "weightKg"),
    reps: readField(formData, "reps"),
    rpe: readField(formData, "rpe"),
  };

  const parsed = logSetSchema.safeParse({
    sessionId,
    exerciseName: values.exerciseName,
    weightKg: values.weightKg,
    reps: values.reps,
    rpe: values.rpe,
  });

  if (!parsed.success) {
    // Every schema in `@/lib/validations/workout` carries explicit user-facing
    // copy, so the per-field map is safe to show verbatim. `message` stays a
    // short banner; the detail lives on the field that failed, which is what
    // makes "80.555" point at the weight input instead of a generic toast.
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const exerciseName = parsed.data.exerciseName;
  const exerciseKey = deriveExerciseKey(exerciseName);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Take the session's row lock FIRST. The `completedAt: null` predicate is
      // what makes this a serialization point: a second mutation blocks here
      // until the first commits, then re-evaluates the predicate against the
      // committed row (READ COMMITTED). If the session was finished or deleted
      // meanwhile, this matches 0 rows and the insert below never happens.
      const locked = await tx.workoutSession.updateMany({
        where: { id: parsed.data.sessionId, userId: user.id, completedAt: null },
        data: { updatedAt: new Date() },
      });

      if (locked.count === 0) {
        // Distinguish "gone/foreign" from "already finished" with a read that
        // is still scoped by `userId`, so an id belonging to someone else keeps
        // producing the same answer as one that does not exist.
        const existing = await tx.workoutSession.findFirst({
          where: { id: parsed.data.sessionId, userId: user.id },
          select: { completedAt: true },
        });

        if (existing === null) {
          const message = "Session not found.";
          return { kind: "error" as const, message };
        }

        // A finished session is history: its sets feed the "beat this" callout,
        // so writing to it would rewrite the past. Reopening is a product
        // decision for a later slice, not something this action allows by
        // accident.
        if (existing.completedAt !== null) {
          const message = "This session is finished. Reopen is not supported yet.";
          return { kind: "error" as const, message };
        }

        // Unreachable in practice: only a finish or a discard can make the
        // guarded UPDATE miss while leaving an owned, in-progress row behind.
        const message = GENERIC_FAILURE;
        return { kind: "error" as const, message };
      }

      // Per-exercise numbering, matching `@@unique([sessionId, exerciseKey,
      // setNumber])`. The lock above serializes writers, so this `_max` sees
      // every committed set; the unique constraint stays as the backstop and
      // the catch below still reports P2002 as a retry.
      const highest = await tx.workoutSet.aggregate({
        where: { sessionId: parsed.data.sessionId, exerciseKey },
        _max: { setNumber: true },
      });
      const setNumber = (highest._max.setNumber ?? 0) + 1;

      await tx.workoutSet.create({
        data: {
          sessionId: parsed.data.sessionId,
          // Display name as typed, canonical key as derived: both are stored so
          // the UI can render the first and the history query can match the
          // second.
          exerciseName,
          exerciseKey,
          setNumber,
          // Already bounded to two decimals by the schema, so the number's
          // shortest round-trip representation is exactly what the user typed.
          weightKg: parsed.data.weightKg,
          reps: parsed.data.reps,
          rpe: parsed.data.rpe,
        },
        select: { id: true },
      });

      return { kind: "success" as const };
    });

    if (outcome.kind === "error") {
      // Anchored to `sessionId` as well as `message`: every visible field is
      // valid here, so without a field the form has nothing to mark and the
      // failure would read like a problem with the exercise name.
      return {
        status: "error",
        message: outcome.message,
        fieldErrors: { sessionId: [outcome.message] },
        values,
      };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Two submits computed the same `setNumber`. The other one won, so the set
      // probably already exists — tell the user to look before retrying, rather
      // than logging a duplicate under the next number. No visible field is
      // wrong, so the anchor is `sessionId`.
      const message = "That set was saved by another tap. Reload the page to see it.";
      return { status: "error", message, fieldErrors: { sessionId: [message] }, values };
    }

    console.error("Failed to log workout set:", error);
    return { status: "error", message: GENERIC_FAILURE, values };
  }

  // Both paths matter: the session page gains a set, and the history list's
  // `setCount` changes.
  revalidatePath(sessionPath(sessionId));
  revalidatePath(WORKOUTS_PATH);

  return { status: "success", message: "Set logged." };
}

/**
 * Delete a set from an in-progress session.
 *
 * The session row is locked first (the same guarded `updateMany` as every other
 * mutation), so a concurrent `finishSession` either completes before this starts
 * — in which case the lock misses and the set is treated as not found — or waits
 * until this transaction commits. A set in a *finished* session can never be
 * deleted, which is what keeps a completed session from dropping to zero sets.
 *
 * Remaining sets are deliberately NOT renumbered. `setNumber` is a historical
 * label ("this was the third set"), gaps are harmless, and renumbering would
 * have to update rows one at a time — transiently colliding with
 * `@@unique([sessionId, exerciseKey, setNumber])` on every shift.
 */
export async function deleteSet(setId: string): Promise<WorkoutMutationResult> {
  const parsed = deleteSetSchema.safeParse({ id: setId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Read first only to learn which session to lock (and which page to
      // revalidate): the delete itself is keyed by the set id.
      const set = await tx.workoutSet.findFirst({
        where: {
          id: parsed.data.id,
          session: { userId: user.id, completedAt: null },
        },
        select: { sessionId: true },
      });

      if (set === null) {
        return { kind: "error" as const, message: "Set not found." };
      }

      // Serialize with finish/discard/log-set. The `completedAt: null`
      // predicate is re-checked under READ COMMITTED after any wait, so a
      // finish that committed first makes this miss — and the set survives.
      const locked = await tx.workoutSession.updateMany({
        where: { id: set.sessionId, userId: user.id, completedAt: null },
        data: { updatedAt: new Date() },
      });

      if (locked.count === 0) {
        return { kind: "error" as const, message: "Set not found." };
      }

      // The session lock is held, so the set cannot be deleted or moved by
      // another transaction between the read above and this write.
      const result = await tx.workoutSet.deleteMany({
        where: { id: parsed.data.id, sessionId: set.sessionId },
      });

      if (result.count === 0) {
        return { kind: "error" as const, message: "Set not found." };
      }

      return { kind: "success" as const, sessionId: set.sessionId };
    });

    if (outcome.kind === "error") {
      return { ok: false, message: outcome.message };
    }

    revalidatePath(sessionPath(outcome.sessionId));
    // `setCount` in the history list changed too.
    revalidatePath(WORKOUTS_PATH);
  } catch (error) {
    console.error("Failed to delete workout set:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}

/**
 * Close a session, making its sets eligible as future "beat this" targets.
 *
 * A session with no sets is not a workout: finishing it would put an empty
 * session into the history that the overload callout could pick as "most
 * recent". The row lock is taken before the set count and held through the
 * `completedAt` stamp, so a concurrent delete cannot remove the last set in
 * between — the invariant is that a finished session always has at least one
 * set. The `completedAt: null` predicate also makes a double-click converge
 * instead of closing twice with two different timestamps.
 */
export async function finishSession(sessionId: string): Promise<WorkoutMutationResult> {
  const parsed = finishSessionSchema.safeParse({ sessionId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Lock the session and re-check its state under READ COMMITTED. A finish
      // that waits behind a logging insert sees that insert when it counts; a
      // finish that waits behind another finish (or a discard) fails here.
      const locked = await tx.workoutSession.updateMany({
        where: { id: parsed.data.sessionId, userId: user.id, completedAt: null },
        data: { updatedAt: new Date() },
      });

      if (locked.count === 0) {
        const existing = await tx.workoutSession.findFirst({
          where: { id: parsed.data.sessionId, userId: user.id },
          select: { completedAt: true },
        });

        if (existing === null) {
          return { kind: "error" as const, message: "Session not found." };
        }

        if (existing.completedAt !== null) {
          return { kind: "error" as const, message: "This session is already finished." };
        }

        return {
          kind: "error" as const,
          message: "This session changed before it could be finished. Reload and try again.",
        };
      }

      // Counted inside the transaction while the lock is held, so no set can be
      // added (irrelevant — the session is about to close) or deleted (the
      // case that matters) between this check and the stamp below.
      const setCount = await tx.workoutSet.count({
        where: { sessionId: parsed.data.sessionId },
      });

      if (setCount === 0) {
        return { kind: "error" as const, message: "Log at least one set before finishing." };
      }

      // The guarded predicate is repeated for defense in depth even though the
      // lock makes a concurrent state change impossible until this commits.
      const stamped = await tx.workoutSession.updateMany({
        where: { id: parsed.data.sessionId, userId: user.id, completedAt: null },
        data: { completedAt: new Date() },
      });

      if (stamped.count === 0) {
        return {
          kind: "error" as const,
          message: "This session changed before it could be finished. Reload and try again.",
        };
      }

      return { kind: "success" as const };
    });

    if (outcome.kind === "error") {
      return { ok: false, message: outcome.message };
    }

    revalidatePath(WORKOUTS_PATH);
    revalidatePath(sessionPath(parsed.data.sessionId));
  } catch (error) {
    console.error("Failed to finish workout session:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}

/**
 * Delete an in-progress session and, via `onDelete: Cascade`, its sets.
 *
 * Only allowed while `completedAt IS NULL`: an in-progress session is scratch
 * work, whereas a finished one is history the overload callout reads. The row
 * lock is taken before the state check, so a finish racing this discard either
 * commits first (and the discard refuses) or waits until the delete is done.
 */
export async function discardSession(
  sessionId: string,
): Promise<WorkoutMutationResult> {
  const parsed = discardSessionSchema.safeParse({ sessionId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.workoutSession.updateMany({
        where: { id: parsed.data.sessionId, userId: user.id, completedAt: null },
        data: { updatedAt: new Date() },
      });

      if (locked.count === 0) {
        const existing = await tx.workoutSession.findFirst({
          where: { id: parsed.data.sessionId, userId: user.id },
          select: { completedAt: true },
        });

        if (existing === null) {
          return { kind: "error" as const, message: "Session not found." };
        }

        return { kind: "error" as const, message: "Finished sessions can't be discarded." };
      }

      // The lock is held, so the guard can only fail if the row vanished in a
      // way the lock did not observe — treated as "not found", same as before.
      const result = await tx.workoutSession.deleteMany({
        where: { id: parsed.data.sessionId, userId: user.id, completedAt: null },
      });

      if (result.count === 0) {
        return { kind: "error" as const, message: "Session not found." };
      }

      return { kind: "success" as const };
    });

    if (outcome.kind === "error") {
      return { ok: false, message: outcome.message };
    }

    revalidatePath(WORKOUTS_PATH);
    // The page that linked here no longer exists; clearing it keeps a cached
    // RSC payload from resurrecting a deleted session.
    revalidatePath(sessionPath(parsed.data.sessionId));
  } catch (error) {
    console.error("Failed to discard workout session:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}
