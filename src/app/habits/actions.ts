"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate, todayIso } from "@/lib/date";
import { prisma } from "@/lib/db";
import {
  archiveHabitSchema,
  createHabitSchema,
  toggleHabitSchema,
  type HabitFieldErrors,
} from "@/lib/validations/habit";

export type HabitActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: HabitFieldErrors;
  // Echo back what the user typed so the form can re-render after a failed
  // submit without losing input.
  values?: { name: string; description: string };
};

/** Called directly from the client (not a form), so the args are plain values. */
export type ToggleHabitResult = { ok: true } | { ok: false; message: string };

export type ArchiveHabitResult = { ok: true } | { ok: false; message: string };

/** The one path every mutation in this file invalidates. */
const HABITS_PATH = "/habits";

const GENERIC_FAILURE = "Something went wrong. Please try again.";

/** Read a `FormData` entry as a string; absent or non-string entries become "". */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * The first human-readable message from a failed parse.
 *
 * Every schema in `@/lib/validations/habit` supplies explicit copy, so whatever
 * surfaces here is already user-facing — never a Zod default like
 * "Too small: expected string to have >=1 characters".
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
 * Create a habit, or un-archive the one that already holds its name.
 *
 * `Habit` is `@@unique([userId, name])` while archiving — not deleting — is the
 * lifecycle. So "read 20m" archived last month still owns that name, and a
 * plain `create` would fail with P2002 the moment the user re-adds it. Restoring
 * the archived row instead keeps its history and makes the action idempotent
 * from the user's point of view: they see the habit come back, not an error.
 */
export async function createHabit(
  prevState: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  // Ownership is derived server-side, never taken from the form. A posted
  // `userId` field is ignored entirely.
  const user = await getCurrentUser();

  const values = {
    name: readField(formData, "name"),
    description: readField(formData, "description"),
  };

  const parsed = createHabitSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  // Trimmed by the schema; `description` is `null` (not "") when left blank.
  const name = parsed.data.name;
  const description = parsed.data.description ?? null;

  try {
    const existing = await prisma.habit.findUnique({
      where: { userId_name: { userId: user.id, name } },
      select: { id: true, archivedAt: true },
    });

    if (existing !== null) {
      if (existing.archivedAt === null) {
        return {
          status: "error",
          message: "Please fix the highlighted fields.",
          fieldErrors: { name: ["You already have a habit called that."] },
          values,
        };
      }

      await prisma.habit.update({
        where: { id: existing.id },
        data: {
          archivedAt: null,
          // Only a non-null submitted description replaces the stored one. The
          // re-add form starts empty, so a blank field parses to `null`; writing
          // that through unconditionally would silently wipe the description
          // still stored on the archived row. A blank field means "leave it as
          // it was", not "clear it".
          ...(description !== null ? { description } : {}),
        },
      });

      revalidatePath(HABITS_PATH);

      return {
        status: "success",
        message: `Restored "${name}" — its history is still here.`,
      };
    }

    // New habits append to the bottom of the checklist. `_max` is null on an
    // empty checklist, so the first habit gets sortOrder 0.
    const highest = await prisma.habit.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });

    await prisma.habit.create({
      data: {
        userId: user.id,
        name,
        description,
        sortOrder: (highest._max.sortOrder ?? -1) + 1,
      },
    });
  } catch (error) {
    // P2002 here means a concurrent submit won the race between the lookup
    // above and this write; report it as the duplicate it is rather than as a
    // generic failure.
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: { name: ["You already have a habit called that."] },
        values,
      };
    }

    // Prisma errors can leak schema/connection details; log them server-side
    // and hand the client a generic message.
    console.error("Failed to create habit:", error);
    return { status: "error", message: GENERIC_FAILURE, values };
  }

  revalidatePath(HABITS_PATH);

  return { status: "success", message: `Added "${name}".` };
}

/**
 * Set a habit's completion for one day.
 *
 * Reached by direct POST, so nothing about the caller is trustworthy: the habit
 * must be re-checked against the current user, the date against the user's
 * "today", and the flag must be written explicitly.
 */
export async function toggleHabit(
  habitId: string,
  dateIso: string,
  completed: boolean,
): Promise<ToggleHabitResult> {
  const parsed = toggleHabitSchema.safeParse({ habitId, date: dateIso, completed });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();
  const date = parsed.data.date;

  try {
    // Ownership check. Without it, any cuid-shaped id from the client could
    // toggle another user's habit — the `userId` column would be decorative.
    const habit = await prisma.habit.findFirst({
      where: { id: parsed.data.habitId, userId: user.id },
      select: { id: true, archivedAt: true },
    });

    // Same message as a malformed id: whether the habit belongs to someone else
    // or does not exist is not information this endpoint should reveal.
    if (habit === null) {
      return { ok: false, message: "Habit not found." };
    }

    if (habit.archivedAt !== null) {
      return {
        ok: false,
        message: "That habit is archived. Restore it before checking it off.",
      };
    }

    // Future days are impossible. Past days are deliberately allowed even
    // though the UI only offers today: backfilling becomes a UI-only change.
    if (date > todayIso(user.timezone)) {
      return { ok: false, message: "You can't check off a day that hasn't happened yet." };
    }

    // An explicit boolean, never a read-then-flip: two concurrent taps then
    // converge on the last value instead of racing to the same result. `false`
    // is stored as a row rather than deleting one, so "I unticked this" stays
    // visible in history.
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date: parseIsoDate(date) } },
      create: { habitId: habit.id, date: parseIsoDate(date), completed },
      update: { completed },
    });
  } catch (error) {
    console.error("Failed to toggle habit:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  revalidatePath(HABITS_PATH);

  return { ok: true };
}

/**
 * Soft-delete a habit.
 *
 * `archivedAt` (never a hard `delete()`) is what lets the streak and rate
 * history survive, and what makes re-adding the same name a restore rather than
 * a P2002. The `userId` in the `where` is the ownership check, in the same
 * statement as the write, so there is no window between the two.
 */
export async function archiveHabit(habitId: string): Promise<ArchiveHabitResult> {
  const parsed = archiveHabitSchema.safeParse({ habitId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const result = await prisma.habit.updateMany({
      where: { id: parsed.data.habitId, userId: user.id },
      data: { archivedAt: new Date() },
    });

    if (result.count === 0) {
      return { ok: false, message: "Habit not found." };
    }
  } catch (error) {
    console.error("Failed to archive habit:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  revalidatePath(HABITS_PATH);

  return { ok: true };
}
