"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  profileSchema,
  type ProfileFieldErrors,
} from "@/lib/validations/profile";

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: ProfileFieldErrors;
  // Echo back what the user typed so the form can re-render after a failed
  // submit without losing input.
  values?: { timezone: string; goalWeightKg: string };
};

/**
 * Every route whose rendering depends on the profile.
 *
 * The timezone is not cosmetic: `todayIso(user.timezone)` decides which calendar
 * day is "today" for the dashboard, the metrics date nav and the habit
 * checklist, and `goalWeightKg` feeds the dashboard goal card. Changing the
 * timezone silently re-labels existing days (a log written at 02:00 IST belongs
 * to the previous UTC day), so revalidating only `/settings` would leave stale
 * "today" renders on every other page. Keep this list in sync with any future
 * screen that calls `todayIso` or reads `goalWeightKg`.
 */
const PROFILE_DEPENDENT_PATHS = [
  "/settings",
  "/",
  "/metrics",
  "/habits",
  "/workouts",
] as const;

/** Read a `FormData` entry as a string; absent or non-string entries become "". */
function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateProfile(
  prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  // Ownership is derived server-side, never taken from the form. A posted
  // `userId` field is ignored entirely.
  const user = await getCurrentUser();

  const values = {
    timezone: readField(formData, "timezone"),
    goalWeightKg: readField(formData, "goalWeightKg"),
  };

  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const { timezone, goalWeightKg } = parsed.data;

  try {
    await prisma.user.update({
      where: { id: user.id },
      // `?? null` is deliberate: a cleared goal is "no goal", and storing `0`
      // would render a 0 kg target and skew any progress calculation.
      data: { timezone, goalWeightKg: goalWeightKg ?? null },
    });
  } catch (error) {
    // Prisma errors can leak schema/connection details; log them server-side
    // and hand the client a generic message.
    console.error("Failed to update profile:", error);
    return {
      status: "error",
      message: "Could not save your profile. Please try again.",
      values,
    };
  }

  for (const path of PROFILE_DEPENDENT_PATHS) {
    revalidatePath(path);
  }

  // Compare against the *previous* value so the message can explain the side
  // effect the user just caused: moving the timezone moves what counts as
  // "today", which re-dates the current habit/metric view.
  if (timezone !== user.timezone) {
    return {
      status: "success",
      message: `Profile saved. Your "today" is now calculated in ${timezone}, so habit and metric days may shift.`,
    };
  }

  return { status: "success", message: "Profile saved." };
}
