import { z } from "zod";

import { isIsoDate } from "@/lib/date";

/**
 * Normalizes "no value entered" to `null`.
 *
 * An untouched HTML input submits `""`, but `""` is a real string, not "the user
 * left this blank". Storing it would render an empty description block instead
 * of no description block, so blank input is collapsed to `null` here — the same
 * convention `daily_metrics` uses for its optional columns.
 *
 * `null`/`undefined` are normalized too, so a field missing from the `FormData`
 * entirely behaves the same as an empty one.
 */
function emptyToNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

/**
 * The single preprocessor behind every optional text column.
 *
 * `schema` describes the *present* value; blank input short-circuits to `null`
 * before the string checks run, and an absent key stays `undefined`.
 */
function optionalField<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToNull, schema.nullable()).optional();
}

/**
 * Every check carries an explicit message. Zod's defaults ("Too small: expected
 * string to have >=1 characters") are rendered verbatim in the form's
 * `FieldError` and read like schema internals rather than help text.
 */
export const createHabitSchema = z.object({
  // 120 matches `Habit.name`'s `@db.VarChar(120)`: a longer value would be
  // rejected by Postgres with an opaque 22001 instead of a form error.
  name: z
    .string("Give the habit a name.")
    .trim()
    .min(1, "Give the habit a name.")
    .max(120, "Habit names must be 120 characters or fewer."),

  // Trimmed before the length check, so 500 trailing spaces can't fail a
  // description the user sees as short.
  description: optionalField(
    z
      .string("Description must be text.")
      .trim()
      .min(1, "Description can't be blank.")
      .max(500, "Description must be 500 characters or fewer."),
  ),
});

export const toggleHabitSchema = z.object({
  // cuid-shaped but not format-checked: the action's ownership query is what
  // decides whether this id means anything. The bounds only stop an absurd
  // payload from reaching Postgres.
  habitId: z
    .string("Habit not found.")
    .trim()
    .min(1, "Habit not found.")
    .max(40, "Habit not found."),

  // Format only. The "not in the future" bound is enforced in the action, which
  // is the only layer that knows the user's timezone.
  date: z
    .string("Enter a valid calendar date (YYYY-MM-DD).")
    .refine(isIsoDate, "Enter a valid calendar date (YYYY-MM-DD)."),

  completed: z.boolean("Expected a true/false completion value."),
});

export const archiveHabitSchema = z.object({
  habitId: z
    .string("Habit not found.")
    .trim()
    .min(1, "Habit not found.")
    .max(40, "Habit not found."),
});

/** The create-form's parsed shape; also the source of the field-error keys. */
export type HabitInput = z.infer<typeof createHabitSchema>;

/** Shape of the flattened Zod errors, keyed by form field. */
export type HabitFieldErrors = Partial<Record<keyof HabitInput, string[]>>;
