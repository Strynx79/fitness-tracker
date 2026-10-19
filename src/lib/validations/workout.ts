import { z } from "zod";

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
 * `weightKg` is `DECIMAL(5,2)` and deliberately accepts `0`: a bodyweight set
 * (pull-up, dip) is a real top set, and rejecting 0 would make the progressive
 * overload callout treat bodyweight work as "no data". A negative weight is
 * never meaningful here (unlike, say, an assisted machine, which the schema
 * cannot express) and is rejected.
 *
 * `rpe` is `DECIMAL(3,1)` in 0.5 steps. The 0.5-step rule is enforced on the
 * number, not the string, because "10.0" and "10" are the same rating.
 */
export const logSetSchema = z.object({
  // Format bounds only. The action's ownership + "not finished" queries are
  // what decide whether this id means anything.
  sessionId: z
    .string("Session not found.")
    .trim()
    .min(1, "Session not found.")
    .max(40, "Session not found."),

  // 120 matches `WorkoutSet.exerciseName`'s `@db.VarChar(120)`.
  exerciseName: z
    .string("Name the exercise.")
    .trim()
    .min(1, "Name the exercise.")
    .max(120, "Exercise names must be 120 characters or fewer."),

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
    | "exerciseName" // logSet
    | "weightKg" // logSet
    | "reps" // logSet
    | "rpe" // logSet
    | "sessionId", // logSet — hidden field, for action-level failures
    string[]
  >
>;
