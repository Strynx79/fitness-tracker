import { z } from "zod";

/**
 * Shared decimal-string validation for `DECIMAL` columns.
 *
 * The pattern below is the same one Slice 1 inlined in
 * `@/lib/validations/daily-metric`: numeric input arrives as a *string*
 * (`<input type="text" inputMode="decimal">`), the precision limit is enforced
 * on that string before it ever becomes a `number`, and only then is it range
 * checked.
 *
 * Why the string check instead of `.multipleOf()`: binary floating point makes
 * `80.55 / 0.01 === 8054.999999999999`, so a `.multipleOf(0.01)` "at most 2
 * decimals" rule rejects legitimate weights. Why not `z.coerce.number()` either:
 * `Number("")` is `0`, and `Number("1e3")` / `Number("0x10")` are values the user
 * never typed.
 *
 * Extracted into its own module (rather than reusing Slice 1's inline version)
 * because the *ranges* differ per column: workout weight may legitimately be `0`
 * (bodyweight), while a bodyweight-scale reading must be `> 0`. Slice 1's
 * schema is committed, verified code and is deliberately left untouched — see
 * the consolidation note in the Slice 3 report.
 */

/**
 * Normalizes "no value entered" to `null`.
 *
 * An untouched HTML input submits `""`, and a `FormData` key that was never
 * rendered reads back as absent (`undefined`). Both mean "unknown" for an
 * optional column, so they collapse to `null` before any coercion runs. A real
 * `"0"` is *not* blank and must survive as `0` — that is the whole reason this
 * cannot be `z.coerce.number()`.
 */
export function emptyToNull(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

/**
 * Every supported shape of "a number", with an optional decimal part.
 *
 * Two patterns so the two failure modes stay distinguishable for the user:
 * "that isn't a number at all" versus "that has too much precision".
 */
const DECIMAL_NOTATION = /^[+-]?\d+(?:\.\d+)?$/;

/** `^\d+$` for an integer column; a ranged decimal pattern otherwise. */
function precisionPattern(maxDecimals: number): RegExp {
  if (maxDecimals === 0) return /^[+-]?\d+$/;
  return new RegExp(`^[+-]?\\d+(?:\\.\\d{1,${maxDecimals}})?$`);
}

function decimalPlacesPhrase(count: number): string {
  return count === 1 ? "1 decimal place" : `${count} decimal places`;
}

export type DecimalFieldOptions = {
  /** Human-facing column name; every default message is built from it. */
  label: string;
  /** Inclusive lower bound. `0` is a value, not "missing". */
  min: number;
  /** Inclusive upper bound; keep in step with the column width. */
  max: number;
  /**
   * Decimal places the column can store — 2 for `DECIMAL(5,2)`, 1 for
   * `DECIMAL(3,1)`, 0 for an `Int`. Anything longer would be silently rounded by
   * Postgres while the form still showed the digits the user typed.
   */
  maxDecimals: number;
  /** When set, only whole multiples are accepted (e.g. `0.5` for RPE). */
  step?: number;
  notANumberMessage?: string;
  precisionMessage?: string;
  minMessage?: string;
  maxMessage?: string;
  stepMessage?: string;
  requiredMessage?: string;
};

/**
 * The one place a decimal string becomes a `number`.
 *
 * The pipeline is strictly ordered:
 *
 *   1. blank (or absent) short-circuits to `null` — but only for the optional
 *      variant; see `requiredDecimalField`
 *   2. not-a-number is rejected on the string, with a friendly message
 *   3. too many decimals is rejected on the string, so the stored value is
 *      byte-for-byte what the user typed
 *   4. only then is it converted, and the range/step checks run on the number
 *
 * Every check carries an explicit message: Zod's defaults ("Too small: expected
 * number to be >=0") are rendered verbatim in the form's `FieldError` and read
 * like schema internals rather than help text.
 */
function buildDecimalSchema(options: DecimalFieldOptions): z.ZodType<number | null> {
  const { label, min, max, maxDecimals, step } = options;

  if (!Number.isInteger(maxDecimals) || maxDecimals < 0 || maxDecimals > 6) {
    // Guards the interpolated quantifier in `precisionPattern`; a programming
    // error should fail loudly at import time, not silently accept anything.
    throw new Error(
      `decimalField(${label}): maxDecimals must be an integer 0..6, received ${maxDecimals}`,
    );
  }
  if (min > max) {
    throw new Error(`decimalField(${label}): min (${min}) must not exceed max (${max})`);
  }

  const notANumberMessage = options.notANumberMessage ?? `${label} must be a number.`;
  const precisionMessage =
    options.precisionMessage ??
    (maxDecimals === 0
      ? `${label} must be a whole number.`
      : `${label} can have at most ${decimalPlacesPhrase(maxDecimals)}.`);
  const minMessage =
    options.minMessage ??
    (min <= 0 ? `${label} can't be negative.` : `${label} must be at least ${min}.`);
  const maxMessage = options.maxMessage ?? `${label} must be ${max} or less.`;

  let numberSchema = z
    .number()
    .gte(min, minMessage)
    .lte(max, maxMessage);

  if (step !== undefined) {
    // Float-safe "is a multiple of `step`" test. For a power-of-two step such as
    // RPE's 0.5, division and multiplication are exact in binary floating point,
    // so this is identical to the `Math.round(v * 2) === v * 2` trick — but it
    // also covers a step like 0.25 without hardcoding the reciprocal.
    const stepMessage = options.stepMessage ?? `${label} must be in steps of ${step}.`;
    numberSchema = numberSchema.refine(
      (value) => Number.isInteger(value / step),
      stepMessage,
    );
  }

  return z.preprocess(
    emptyToNull,
    z
      .string(notANumberMessage)
      .trim()
      .regex(DECIMAL_NOTATION, notANumberMessage)
      .refine((value) => precisionPattern(maxDecimals).test(value), precisionMessage)
      // Safe to convert only after the shape above is proven: `Number` can no
      // longer see a grouping separator, exponent or radix prefix.
      .transform((value) => Number(value))
      .pipe(numberSchema)
      .nullable(),
  );
}

/**
 * Optional decimal field: `""`, whitespace, `null` and absent all parse to
 * `null`; anything else must be a number in `[min, max]` with at most
 * `maxDecimals` places.
 */
export function optionalDecimalField(options: DecimalFieldOptions): z.ZodType<number | null> {
  return buildDecimalSchema(options);
}

/**
 * Required decimal field: identical, except blank input is a validation error
 * instead of `null`.
 *
 * The `refine` predicate narrows `number | null` to `number` in the parsed
 * output, which is the whole point: a required column must not leave a `null`
 * branch for every caller to handle.
 */
export function requiredDecimalField(options: DecimalFieldOptions): z.ZodType<number> {
  const requiredMessage = options.requiredMessage ?? `Enter ${options.label.toLowerCase()}.`;

  return optionalDecimalField(options).refine(
    (value): value is number => value !== null,
    requiredMessage,
  );
}

/**
 * Same shape as `optionalDecimalField`, but only for values that are whole
 * multiples of 1 — i.e. an `Int` column (`maxDecimals: 0` makes the string
 * pattern `^\d+$`, so `"1.5"`, `"1e3"` and `"0x10"` never reach Postgres).
 */
export function integerField(
  options: Omit<DecimalFieldOptions, "maxDecimals">,
): z.ZodType<number> {
  return requiredDecimalField({ ...options, maxDecimals: 0 });
}
