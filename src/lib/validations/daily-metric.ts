import { z } from "zod";

import { isIsoDate } from "@/lib/date";

/**
 * Normalizes "no value entered" to `null`.
 *
 * An untouched HTML input submits `""`, and `z.coerce.number()` turns `""` into
 * `0` (`Number("") === 0`). Without this guard a user who only weighed in would
 * silently record `calories: 0` / `proteinG: 0`, which is a real value and would
 * drag every average toward zero. `null` means "unknown", which is what the
 * aggregate queries expect.
 *
 * `null`/`undefined` are normalized too, so a field that is missing from the
 * `FormData` entirely behaves the same as an empty one.
 */
function emptyToNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

/**
 * The single preprocessor behind every optional column, so weight, calories,
 * protein and notes all treat blank input identically.
 *
 * `schema` describes the *present* value; blank input short-circuits to `null`
 * before coercion ever runs, and an absent key stays `undefined`.
 */
function optionalField<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToNull, schema.nullable()).optional();
}

/**
 * Every check carries an explicit message, because Zod's defaults ("Too small:
 * expected number to be >0") are rendered verbatim inside the form's
 * `FieldError` and read like schema internals, not like help text.
 */
const NUMBER_MESSAGE = "Enter a number.";

/**
 * Weight arrives as text (`<input type="text" inputMode="decimal">`), so the
 * precision limit is enforced on the *string* before it becomes a `number`.
 *
 * `weight_kg` is `DECIMAL(5,2)`: `80.555` would be silently rounded to `80.56`
 * by Postgres while the form still showed `80.555`. Rejecting the third decimal
 * keeps the stored value identical to what the user typed.
 *
 * A string check, not `.multipleOf(0.01)`, because binary floating point makes
 * `80.55 / 0.01 === 8054.999999999999`, which would reject legitimate weights.
 *
 * Two patterns so the two failure modes stay distinguishable: not-a-number at
 * all versus a number with too much precision.
 */
const DECIMAL_NOTATION = /^[+-]?\d+(?:\.\d+)?$/;
const AT_MOST_TWO_DECIMALS = /^[+-]?\d+(?:\.\d{1,2})?$/;

const weightKgSchema = z
  .string(NUMBER_MESSAGE)
  .trim()
  .regex(DECIMAL_NOTATION, NUMBER_MESSAGE)
  .refine(
    (value) => AT_MOST_TWO_DECIMALS.test(value),
    "Weight can have at most 2 decimal places.",
  )
  // Safe to convert only after the shape above is proven: `Number` cannot see a
  // grouping separator, exponent or radix prefix any more.
  .transform(Number)
  .pipe(
    z
      .number()
      // `> 0` (not `>= 0`): a weight of 0 is a missing weigh-in, not a
      // measurement.
      .gt(0, "Weight must be greater than 0.")
      .lte(400, "Weight must be 400 kg or less."),
  );

export const dailyMetricInputSchema = z.object({
  // Format only. The future/too-old bounds are enforced in the action, which is
  // the only layer that knows the user's timezone.
  date: z
    .string("Enter a valid calendar date (YYYY-MM-DD).")
    .refine(isIsoDate, "Enter a valid calendar date (YYYY-MM-DD)."),

  weightKg: optionalField(weightKgSchema),

  // `0` is a legitimate value here (a fasted day), so the floor is inclusive.
  calories: optionalField(
    z.coerce
      .number(NUMBER_MESSAGE)
      .int("Calories must be a whole number.")
      .gte(0, "Calories must be between 0 and 20000.")
      .lte(20_000, "Calories must be between 0 and 20000."),
  ),

  proteinG: optionalField(
    z.coerce
      .number(NUMBER_MESSAGE)
      .int("Protein must be a whole number.")
      .gte(0, "Protein must be between 0 and 1000.")
      .lte(1_000, "Protein must be between 0 and 1000."),
  ),

  // Trimmed first, so a whitespace-only string is null (handled by the
  // preprocessor) rather than a `""` that renders as a blank notes block.
  notes: optionalField(
    z
      .string("Notes must be text.")
      .trim()
      .min(1, "Notes can't be blank.")
      .max(2_000, "Notes must be 2000 characters or fewer."),
  ),
});

export type DailyMetricInput = z.infer<typeof dailyMetricInputSchema>;

/** Shape of the flattened Zod errors, keyed by form field. */
export type DailyMetricFieldErrors = Partial<
  Record<keyof DailyMetricInput, string[]>
>;
