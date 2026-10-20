import { z } from "zod";

import { optionalDecimalField } from "@/lib/validations/numbers";

/**
 * True when `Intl` can resolve `value` as an IANA timezone.
 *
 * Validation is by *construction*, not by list membership. `Intl.supportedValuesOf
 * ("timeZone")` returns only the **canonical** names — 418 of them on Node 24 —
 * and `Asia/Kolkata` is NOT one of them; the canonical entry is `Asia/Calcutta`.
 * The seeded user's stored timezone is exactly `Asia/Kolkata`, so a membership
 * check would reject the user's own current value and make the settings form
 * unable to render its selected option.
 *
 * `Intl.DateTimeFormat` accepts both canonical names and links/aliases, which is
 * the exact behaviour we need. Its `RangeError` on an unknown zone is the real
 * failure mode being guarded against: `todayIso()` runs on every page, so an
 * invalid stored zone would throw at render time and take the whole app down —
 * i.e. this is a data-integrity guard, not just a form nicety.
 *
 * Do not "simplify" this back into `supportedValuesOf(...).includes(value)`.
 */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const profileSchema = z.object({
  // `@db.VarChar(64)` on `User.timezone`: anything longer would be rejected by
  // Postgres with an opaque 22001 instead of a form error.
  timezone: z
    .string("Choose a timezone.")
    .trim()
    .min(1, "Choose a timezone.")
    .max(64, "Timezone must be 64 characters or fewer.")
    .refine(isValidTimeZone, "Choose a valid timezone."),

  // `goal_weight_kg` is `DECIMAL(5,2)`; the shared builder enforces the string
  // precision before conversion and collapses `""`/whitespace/absent to `null`.
  // `null` means "no goal", which is distinct from `0` — a cleared goal must
  // persist as NULL, not as a zero-kilogram target.
  goalWeightKg: optionalDecimalField({
    label: "Weight",
    min: 20,
    max: 400,
    maxDecimals: 2,
    notANumberMessage: "Weight must be a number.",
    precisionMessage: "Weight can have at most 2 decimal places.",
    minMessage: "Weight must be between 20 kg and 400 kg.",
    maxMessage: "Weight must be between 20 kg and 400 kg.",
  }),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Shape of the flattened Zod errors, keyed by form field. */
export type ProfileFieldErrors = Partial<Record<keyof ProfileInput, string[]>>;
