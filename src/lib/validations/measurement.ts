import { z } from "zod";

import { isIsoDate } from "@/lib/date";

/**
 * Validation for body measurements.
 *
 * The unit is free text ("cm", "in", "%") rather than an enum: users mix metric
 * and imperial per measurement, and nothing in the app converts between them, so
 * pretending there is one canonical unit would only add friction.
 */

/** 60 matches `MeasurementType.name`'s `@db.VarChar(60)`. */
export const createMeasurementTypeSchema = z.object({
  name: z
    .string("Name the measurement.")
    .trim()
    .min(1, "Name the measurement.")
    .max(60, "Measurement names must be 60 characters or fewer."),

  unit: z
    .string("Add a unit, e.g. cm.")
    .trim()
    .min(1, "Add a unit, e.g. cm.")
    .max(16, "Units must be 16 characters or fewer."),
});

const MAX_MEASUREMENT = 10_000;

/**
 * One reading.
 *
 * `value` is `DECIMAL(6,2)`: the string is checked for at most two decimals
 * BEFORE it becomes a number, the same rule the weight inputs use. `0` is a real
 * reading (a stiff morning, a zeroed tape), never "missing".
 */
export const measurementEntrySchema = z.object({
  typeId: z
    .string("Measurement not found.")
    .trim()
    .min(1, "Measurement not found.")
    .max(40, "Measurement not found."),

  date: z
    .string("Pick a date.")
    .refine((value) => isIsoDate(value), "Pick a valid date."),

  value: z
    .string("Enter a value.")
    .trim()
    .min(1, "Enter a value.")
    .regex(/^\d+(\.\d{1,2})?$/, "Use a number with at most two decimals.")
    .transform((value) => Number(value))
    .refine(
      (value) => Number.isFinite(value) && value <= MAX_MEASUREMENT,
      `Values must be ${MAX_MEASUREMENT} or less.`,
    ),
});

export const measurementEntryIdSchema = z.object({
  id: z
    .string("Reading not found.")
    .trim()
    .min(1, "Reading not found.")
    .max(40, "Reading not found."),
});

export const measurementTypeIdSchema = z.object({
  typeId: z
    .string("Measurement not found.")
    .trim()
    .min(1, "Measurement not found.")
    .max(40, "Measurement not found."),
});
