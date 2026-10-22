import { z } from "zod";

import { isIsoDate } from "@/lib/date";
import {
  emptyToNull,
  integerField,
  optionalDecimalField,
  requiredDecimalField,
} from "@/lib/validations/numbers";

/**
 * Validation for Slice 3 — workout sessions and logged sets.
 *
 * Two shapes live here:
 *
 *   - `createSessionSchema`  → the "start a workout" form
 *   - `logSetSchema`         → the "log a set" form
 *
 * plus the id-only envelopes used by the row actions (delete/finish/discard).
 *
 * Note what is NOT here: `exerciseKey`. It is *derived* from `exerciseName` in
 * the server action, so "Bench Press" and "bench  press" resolve to one
 * exercise. A `.transform()` on the name would look equivalent but would make
 * the key part of the form payload, which is exactly the trust boundary this
 * schema exists to hold.
 */

/**
 * The single preprocessor behind the optional text column (`notes`).
 *
 * Mirrors `@/lib/validations/habit`: `""` and whitespace are "no notes", not an
 * empty notes block, and an absent `FormData` key behaves the same.
 */
function optionalText<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToNull, schema.nullable()).optional();
}

/**
 * 80 matches `WorkoutSession.name`'s `@db.VarChar(80)`: a longer value would be
 * rejected by Postgres with an opaque 22001 instead of a readable form error.
 */
export const createSessionSchema = z.object({
  name: z
    .string("Give the session a name.")
    .trim()
    .min(1, "Give the session a name.")
    .max(80, "Session names must be 80 characters or fewer."),

  notes: optionalText(
    z
      .string("Notes must be text.")
      .trim()
      .min(1, "Notes can't be blank.")
      .max(1_000, "Notes must be 1000 characters or fewer."),
  ),
});

/**
 * One logged set.
 *
 * The exercise is identified by its BLOCK (`workoutExerciseId`), not by a name:
 * the block already holds the display name and catalog link, so the set cannot
 * disagree with the card it appears under.
 *
 * `weightKg` is `DECIMAL(5,2)` and deliberately accepts `0`: a bodyweight set
 * (pull-up, dip) is a real top set, and rejecting 0 would make the progressive
 * overload callout treat bodyweight work as "no data". A negative weight is
 * never meaningful here and is rejected.
 *
 * `rpe` is `DECIMAL(3,1)` in 0.5 steps. The 0.5-step rule is enforced on the
 * number, not the string, because "10.0" and "10" are the same rating.
 */
export const logSetSchema = z.object({
  // Format bounds only. The action's ownership + "not finished" queries decide
  // whether this id means anything.
  workoutExerciseId: z
    .string("Exercise not found. Reload the page.")
    .trim()
    .min(1, "Exercise not found. Reload the page.")
    .max(40, "Exercise not found. Reload the page."),

  weightKg: requiredDecimalField({
    label: "Weight",
    min: 0,
    max: 400,
    maxDecimals: 2,
    maxMessage: "Weight must be 400 kg or less.",
    requiredMessage: "Enter the weight. Use 0 for bodyweight.",
  }),

  // `maxDecimals: 0` makes this an integer-field: `"1.5"`, `"1e3"` and `"0x10"`
  // are all rejected on the string, so Postgres never has to round.
  reps: integerField({
    label: "Reps",
    min: 1,
    max: 1_000,
    minMessage: "Reps must be at least 1.",
    maxMessage: "Reps must be 1000 or less.",
    requiredMessage: "Enter the reps.",
  }),

  // Blank → `null` ("left unrated"), which is the column's own convention.
  rpe: optionalDecimalField({
    label: "RPE",
    min: 1,
    max: 10,
    maxDecimals: 1,
    step: 0.5,
    stepMessage: "RPE must be in steps of 0.5.",
  }),
});

/** Id-only envelopes for the row actions; same shape, different copy. */
export const deleteSetSchema = z.object({
  id: z
    .string("Set not found.")
    .trim()
    .min(1, "Set not found.")
    .max(40, "Set not found."),
});

/** Id-only envelope for deleting an exercise block; same shape as a set id. */
export const deleteExerciseBlockSchema = z.object({
  id: z
    .string("Exercise not found.")
    .trim()
    .min(1, "Exercise not found.")
    .max(40, "Exercise not found."),
});

/**
 * Add an exercise card to a session.
 *
 * Exactly one of `exerciseId` (picked from the catalog) or `name` (typed by the
 * user) has to be present — that is what makes "blank exercise pages" and
 * "search and pick" the same action with two entry points.
 */
export const addExerciseBlockSchema = z
  .object({
    sessionId: z
      .string("Session not found.")
      .trim()
      .min(1, "Session not found.")
      .max(40, "Session not found."),

    datasetId: z.preprocess(
      emptyToNull,
      z
        .string("That exercise is no longer in the library.")
        .trim()
        .regex(/^\d{4}$/, "That exercise is no longer in the library.")
        .nullable()
        .optional(),
    ),

    // 120 matches `WorkoutExercise.name`'s `@db.VarChar(120)`.
    name: z.preprocess(
      emptyToNull,
      z
        .string("Name the exercise.")
        .trim()
        .max(120, "Exercise names must be 120 characters or fewer.")
        .nullable()
        .optional(),
    ),
  })
  .refine((value) => value.datasetId != null || value.name != null, {
    message: "Pick an exercise or name one.",
    path: ["name"],
  });

/**
 * Schedule an exercise into a workout on a future date.
 *
 * The date is a calendar date (`YYYY-MM-DD`), not an instant: "Saturday's push
 * day" is a day, and storing an instant would make it shift with the user's
 * timezone. `isIsoDate` rejects "2026-02-31" as well as the wrong shape.
 */
export const scheduleExerciseSchema = z.object({
  datasetId: z
    .string("Exercise not found.")
    .trim()
    .regex(/^\d{4}$/, "Exercise not found."),

  date: z
    .string("Pick a date.")
    .refine((value) => isIsoDate(value), "Pick a valid date."),
});

/** Id-only envelope for closing a session. */
export const finishSessionSchema = z.object({
  sessionId: z
    .string("Session not found.")
    .trim()
    .min(1, "Session not found.")
    .max(40, "Session not found."),
});

export const discardSessionSchema = finishSessionSchema;

/** The create-session form's parsed shape. */
export type WorkoutInput = z.infer<typeof createSessionSchema>;

/**
 * Shape of the flattened Zod errors, keyed by form field.
 *
 * Shared by BOTH workout forms, because both are rendered from the same
 * `WorkoutActionState`:
 *
 *   - create-session → `name`, `notes`
 *   - log-set        → `exerciseName`, `weightKg`, `reps`, `rpe`
 *
 * `sessionId` is not a visible log-set input, but it is the right anchor for
 * the action's non-Zod failures ("Session not found", "already finished"), so
 * the type admits it and the form can surface it above the fields.
 *
 * The union is written out explicitly rather than derived with
 * `keyof WorkoutInput | keyof LogSetInput`: `WorkoutInput` stays the type of
 * the create-session values, and this alias is free to describe exactly the
 * fields the forms can show an error on.
 */
export type WorkoutFieldErrors = Partial<
  Record<
    | "name" // createSession
    | "notes" // createSession
    | "workoutExerciseId" // logSet — hidden field, anchored on the block
    | "weightKg" // logSet
    | "reps" // logSet
    | "rpe" // logSet
    | "sessionId", // logSet/block actions — action-level failures
    string[]
  >
>;
