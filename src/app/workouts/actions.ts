"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate, todayIso } from "@/lib/date";
import { prisma } from "@/lib/db";
import { capitalizeExerciseName, deriveExerciseKey } from "@/lib/exercise";
import { searchExercises, type ExerciseSummary } from "@/lib/exercises";
import {
  addExerciseBlockSchema,
  createSessionSchema,
  deleteExerciseBlockSchema,
  deleteSetSchema,
  discardSessionSchema,
  finishSessionSchema,
  logSetSchema,
  scheduleExerciseSchema,
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
  weightKg: string;
  reps: string;
  rpe: string;
} {
  return { name: "", notes: "", weightKg: "", reps: "", rpe: "" };
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
/**
 * Log one set into an exercise block.
 *
 * The block is resolved first (scoped by the user) because the form posts a
 * block id, not a session id or an exercise name. Then the session row is locked
 * exactly as before: that UPDATE takes a row-level lock Postgres holds until
 * commit, so a concurrent finish or discard either wins outright or waits and
 * then fails its `completedAt: null` predicate — a set can never land in a
 * session that just became history.
 *
 * `setNumber` is computed per block from the database, never taken from the
 * client: it is backed by `@@unique([sessionId, exerciseKey, setNumber])`, and
 * the lock makes the count sequential.
 */
export async function logSet(
  prevState: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  const user = await getCurrentUser();

  const values = {
    ...blankValues(),
    weightKg: readField(formData, "weightKg"),
    reps: readField(formData, "reps"),
    rpe: readField(formData, "rpe"),
  };

  const parsed = logSetSchema.safeParse({
    workoutExerciseId: readField(formData, "workoutExerciseId"),
    weightKg: values.weightKg,
    reps: values.reps,
    rpe: values.rpe,
  });

  if (!parsed.success) {
    // Every schema in `@/lib/validations/workout` carries explicit user-facing
    // copy, so the per-field map is safe to show verbatim.
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  let sessionId: string | null = null;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Ownership is part of the predicate: a block id belonging to another user
      // is indistinguishable from one that does not exist.
      const block = await tx.workoutExercise.findFirst({
        where: {
          id: parsed.data.workoutExerciseId,
          session: { userId: user.id },
        },
        select: {
          id: true,
          sessionId: true,
          name: true,
          nameKey: true,
          exerciseId: true,
        },
      });

      if (block === null) {
        return {
          kind: "error" as const,
          message: "Exercise not found. Reload the page.",
          field: "workoutExerciseId" as const,
        };
      }

      // The serialization point. See the module docs above.
      const locked = await tx.workoutSession.updateMany({
        where: { id: block.sessionId, userId: user.id, completedAt: null },
        data: { updatedAt: new Date() },
      });

      if (locked.count === 0) {
        const existing = await tx.workoutSession.findFirst({
          where: { id: block.sessionId, userId: user.id },
          select: { completedAt: true },
        });

        if (existing === null) {
          return { kind: "error" as const, message: "Session not found." };
        }

        // A finished session is history: its sets feed the "beat this" callout,
        // so writing to it would rewrite the past.
        if (existing.completedAt !== null) {
          return {
            kind: "error" as const,
            message: "This session is finished. Reopen is not supported yet.",
          };
        }

        return { kind: "error" as const, message: GENERIC_FAILURE };
      }

      const highest = await tx.workoutSet.aggregate({
        where: { workoutExerciseId: block.id },
        _max: { setNumber: true },
      });
      const setNumber = (highest._max.setNumber ?? 0) + 1;

      await tx.workoutSet.create({
        data: {
          sessionId: block.sessionId,
          workoutExerciseId: block.id,
          // Copied from the block, never from the form: the row's name and key
          // always describe the card it is rendered under.
          exerciseId: block.exerciseId,
          exerciseName: block.name,
          exerciseKey: block.nameKey,
          setNumber,
          // Already bounded to two decimals by the schema, so the number's
          // shortest round-trip representation is exactly what the user typed.
          weightKg: parsed.data.weightKg,
          reps: parsed.data.reps,
          rpe: parsed.data.rpe,
        },
        select: { id: true },
      });

      return { kind: "success" as const, sessionId: block.sessionId };
    });

    if (outcome.kind === "error") {
      // A block failure belongs on the block; everything else is about the
      // session, and anchoring it there keeps the form from blaming a field the
      // user never touched.
      const anchor =
        "field" in outcome && outcome.field === "workoutExerciseId"
          ? "workoutExerciseId"
          : "sessionId";
      return {
        status: "error",
        message: outcome.message,
        fieldErrors: { [anchor]: [outcome.message] },
        values,
      };
    }

    sessionId = outcome.sessionId;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Two submits computed the same `setNumber`. The other one won, so the set
      // probably already exists — tell the user to look before retrying.
      const message = "That set was saved by another tap. Reload the page to see it.";
      return {
        status: "error",
        message,
        fieldErrors: { sessionId: [message] },
        values,
      };
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
 * Add an exercise card to an open session.
 *
 * Two entry points, one action: `exerciseId` for a catalog pick (the catalog
 * name is authoritative), `name` for a blank/custom card. Adding an exercise
 * that is already in the session is not an error — it focuses the existing card
 * instead, which is what a double tap means.
 */
export async function addExerciseBlock(input: {
  sessionId: string;
  datasetId?: string | null;
  name?: string | null;
}): Promise<WorkoutMutationResult & { blockId?: string }> {
  const parsed = addExerciseBlockSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Same guarded lock as every other session mutation: a finished session
      // must not gain a card.
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

        return {
          kind: "error" as const,
          message: "This session is finished.",
        };
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
        // The refine on the schema guarantees a name when there is no id.
        name = parsed.data.name ?? "";
      }

      const nameKey = deriveExerciseKey(name);

      const existingBlock = await tx.workoutExercise.findFirst({
        where: { sessionId: parsed.data.sessionId, nameKey },
        select: { id: true },
      });

      if (existingBlock !== null) {
        return {
          kind: "success" as const,
          blockId: existingBlock.id,
          created: false,
        };
      }

      const highest = await tx.workoutExercise.aggregate({
        where: { sessionId: parsed.data.sessionId },
        _max: { position: true },
      });

      const created = await tx.workoutExercise.create({
        data: {
          sessionId: parsed.data.sessionId,
          exerciseId,
          name,
          nameKey,
          position: (highest._max.position ?? -1) + 1,
        },
        select: { id: true },
      });

      return { kind: "success" as const, blockId: created.id, created: true };
    });

    if (outcome.kind === "error") {
      return { ok: false, message: outcome.message };
    }

    revalidatePath(sessionPath(parsed.data.sessionId));
    revalidatePath(WORKOUTS_PATH);

    return { ok: true, blockId: outcome.blockId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Lost a race against another tap that created the same block. The card
      // exists, which is all the caller wanted.
      return { ok: true };
    }

    console.error("Failed to add exercise block:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }
}

/**
 * Remove an exercise card and, by cascade, its sets.
 *
 * Only allowed while the session is open — the lock is taken first so a finish
 * racing this delete either commits first (and this refuses) or waits.
 */
export async function deleteExerciseBlock(
  blockId: string,
): Promise<WorkoutMutationResult> {
  const parsed = deleteExerciseBlockSchema.safeParse({ id: blockId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const block = await tx.workoutExercise.findFirst({
        where: {
          id: parsed.data.id,
          session: { userId: user.id, completedAt: null },
        },
        select: { id: true, sessionId: true },
      });

      if (block === null) {
        return { kind: "error" as const, message: "Exercise not found." };
      }

      const locked = await tx.workoutSession.updateMany({
        where: { id: block.sessionId, userId: user.id, completedAt: null },
        data: { updatedAt: new Date() },
      });

      if (locked.count === 0) {
        return { kind: "error" as const, message: "Exercise not found." };
      }

      // `onDelete: Cascade` on workout_sets.workoutExerciseId removes its sets.
      await tx.workoutExercise.deleteMany({
        where: { id: block.id, sessionId: block.sessionId },
      });

      return { kind: "success" as const, sessionId: block.sessionId };
    });

    if (outcome.kind === "error") {
      return { ok: false, message: outcome.message };
    }

    revalidatePath(sessionPath(outcome.sessionId));
    revalidatePath(WORKOUTS_PATH);
  } catch (error) {
    console.error("Failed to delete exercise block:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}

/**
 * Catalog search for the in-session picker.
 *
 * A server action rather than a route handler: the picker runs inside a Client
 * Component, and this reuses `searchExercises` — the same query, ordering and
 * wildcard escaping as the library page. Capped at 8 because the sheet is a
 * "which of these did you mean" list, not a browser.
 */
export async function searchCatalog(query: string): Promise<ExerciseSummary[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];

  const result = await searchExercises({ q: trimmed });
  return result.items.slice(0, 8);
}

/**
 * Put a catalog exercise into a workout on a future date.
 *
 * "Future workout" is modelled as a session with `scheduledFor` set: it already
 * has the blocks and the logging screen, so nothing has to be converted when the
 * day arrives. Reusing an existing scheduled session for the same date keeps
 * "add three exercises to Saturday" from creating three sessions.
 *
 * `startedAt` stays at creation time on purpose — it is when the row was made,
 * and "in progress" is decided by `scheduledFor`, not by that timestamp.
 */
export async function scheduleExercise(input: {
  datasetId: string;
  date: string;
}): Promise<WorkoutMutationResult & { sessionId?: string }> {
  const parsed = scheduleExerciseSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();
  const today = todayIso(user.timezone);

  if (parsed.data.date < today) {
    return { ok: false, message: "Pick today or a future date." };
  }

  try {
    const exercise = await prisma.exercise.findUnique({
      where: { datasetId: parsed.data.datasetId },
      select: { id: true, name: true, nameKey: true },
    });

    if (exercise === null) {
      return { ok: false, message: "Exercise not found." };
    }

    const scheduledFor = parseIsoDate(parsed.data.date);

    // Auto-name, so scheduling stays a two-tap action. "Sat, 24 Oct" fits the
    // 80-char column with room to spare.
    const name = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: user.timezone,
    }).format(scheduledFor);

    const result = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.workoutSession.findFirst({
        where: { userId: user.id, completedAt: null, scheduledFor },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const session =
        existingSession ??
        (await tx.workoutSession.create({
          data: { userId: user.id, name, scheduledFor },
          select: { id: true },
        }));

      const existingBlock = await tx.workoutExercise.findFirst({
        where: { sessionId: session.id, nameKey: exercise.nameKey },
        select: { id: true },
      });

      if (existingBlock === null) {
        const highest = await tx.workoutExercise.aggregate({
          where: { sessionId: session.id },
          _max: { position: true },
        });

        await tx.workoutExercise.create({
          data: {
            sessionId: session.id,
            exerciseId: exercise.id,
            name: capitalizeExerciseName(exercise.name),
            nameKey: exercise.nameKey,
            position: (highest._max.position ?? -1) + 1,
          },
        });
      }

      return { sessionId: session.id };
    });

    revalidatePath(WORKOUTS_PATH);
    revalidatePath(sessionPath(result.sessionId));
    revalidatePath(`/exercises/${parsed.data.datasetId}`);

    return { ok: true, sessionId: result.sessionId };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Two tabs scheduled the same exercise at once; the second one lost the
      // race but the outcome it wanted is already true.
      return { ok: true };
    }

    console.error("Failed to schedule exercise:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }
}

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
    // Completing a session changes the dashboard's "last workout" card, which
    // would otherwise keep showing the previously completed session.
    revalidatePath("/");
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
