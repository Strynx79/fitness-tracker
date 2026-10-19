"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { addDays, parseIsoDate, todayIso } from "@/lib/date";
import { prisma } from "@/lib/db";
import {
  dailyMetricInputSchema,
  type DailyMetricFieldErrors,
} from "@/lib/validations/daily-metric";

export type SaveDailyMetricState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: DailyMetricFieldErrors;
  // Echo back what the user typed so the form can re-render it after a failed
  // submit without losing input.
  values?: {
    date: string;
    weightKg: string;
    calories: string;
    proteinG: string;
    notes: string;
  };
};

/** Nothing may predate this; guards against typos like `0206-10-18`. */
const EARLIEST_ISO_DATE = "2000-01-01";

/** Read a `FormData` entry as a string; absent or non-string entries become "". */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveDailyMetric(
  prevState: SaveDailyMetricState,
  formData: FormData,
): Promise<SaveDailyMetricState> {
  // Ownership is derived server-side, never taken from the form. A posted
  // `userId` field is ignored entirely.
  const user = await getCurrentUser();

  const values = {
    date: readField(formData, "date"),
    weightKg: readField(formData, "weightKg"),
    calories: readField(formData, "calories"),
    proteinG: readField(formData, "proteinG"),
    notes: readField(formData, "notes"),
  };

  const parsed = dailyMetricInputSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const { date } = parsed.data;

  // The timezone-aware bounds live here, not in the schema: only the action can
  // resolve "today" for the user. One day of slack absorbs a user whose clock
  // (or travel) is slightly ahead of their stored timezone.
  const today = todayIso(user.timezone);
  const latestIso = addDays(today, 1);
  if (date < EARLIEST_ISO_DATE) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      // The date is edited in the date nav, not in this form, so the message
      // spells out the bound instead of just saying "invalid".
      fieldErrors: { date: [`Date must be on or after ${EARLIEST_ISO_DATE}.`] },
      values,
    };
  }
  if (date > latestIso) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        date: [`Date can't be in the future. Pick a date on or before ${today}.`],
      },
      values,
    };
  }

  // A day's form is the source of truth, so update fully overwrites: that is
  // what makes clearing a previously-set field possible. `upsert` on the
  // `userId_date` compound key makes a double-submit idempotent.
  const data = {
    weightKg: parsed.data.weightKg ?? null,
    calories: parsed.data.calories ?? null,
    proteinG: parsed.data.proteinG ?? null,
    notes: parsed.data.notes ?? null,
  };

  try {
    await prisma.dailyMetric.upsert({
      where: { userId_date: { userId: user.id, date: parseIsoDate(date) } },
      create: { userId: user.id, date: parseIsoDate(date), ...data },
      update: data,
    });
  } catch (error) {
    // Prisma errors can leak schema/connection details; log them server-side
    // and hand the client a generic message.
    console.error("Failed to save daily metric:", error);
    return {
      status: "error",
      message: "Could not save your entry. Please try again.",
      values,
    };
  }

  revalidatePath("/metrics");

  return { status: "success", message: "Daily metrics saved." };
}
