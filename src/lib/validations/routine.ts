import { z } from "zod";

import { emptyToNull } from "@/lib/validations/numbers";

/**
 * Validation for routines.
 *
 * `weekdays` is an array of 0–6 with no duplicates: it is stored as a Postgres
 * `INTEGER[]`, and a duplicated Monday would render twice in the schedule chips
 * while meaning nothing extra.
 */

/** 80 matches `Routine.name`'s `@db.VarChar(80)`. */
export const createRoutineSchema = z.object({
  name: z
    .string("Give the routine a name.")
    .trim()
    .min(1, "Give the routine a name.")
    .max(80, "Routine names must be 80 characters or fewer."),

  notes: z.preprocess(
    emptyToNull,
    z
      .string("Notes must be text.")
      .trim()
      .min(1, "Notes can't be blank.")
      .max(1_000, "Notes must be 1000 characters or fewer.")
      .nullable()
      .optional(),
  ),
});

export const routineWeekdaysSchema = z.object({
  weekdays: z
    .array(z.number().int().min(0).max(6), "Pick valid days.")
    .max(7, "There are only seven days.")
    .refine((days) => new Set(days).size === days.length, {
      message: "Pick each day only once.",
    }),
});

export const routineIdSchema = z.object({
  routineId: z
    .string("Routine not found.")
    .trim()
    .min(1, "Routine not found.")
    .max(40, "Routine not found."),
});

/**
 * Add an exercise to a routine.
 *
 * Same shape as the session picker: a catalog pick (`datasetId`) or a custom
 * name, never both and never neither.
 */
export const addRoutineExerciseSchema = z
  .object({
    routineId: z
      .string("Routine not found.")
      .trim()
      .min(1, "Routine not found.")
      .max(40, "Routine not found."),

    datasetId: z.preprocess(
      emptyToNull,
      z
        .string("That exercise is no longer in the library.")
        .trim()
        .regex(/^\d{4}$/, "That exercise is no longer in the library.")
        .nullable()
        .optional(),
    ),

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

export const routineExerciseIdSchema = z.object({
  id: z
    .string("Exercise not found.")
    .trim()
    .min(1, "Exercise not found.")
    .max(40, "Exercise not found."),
});
