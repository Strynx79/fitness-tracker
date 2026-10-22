"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate } from "@/lib/date";
import { prisma } from "@/lib/db";
import {
  createMeasurementTypeSchema,
  measurementEntryIdSchema,
  measurementEntrySchema,
  measurementTypeIdSchema,
} from "@/lib/validations/measurement";

export type MeasurementFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "unit", string[]>>;
  values?: { name: string; unit: string };
};

export type MeasurementMutationResult = { ok: true } | { ok: false; message: string };

const MEASUREMENTS_PATH = "/measurements";

const GENERIC_FAILURE = "Something went wrong. Please try again.";

function measurementPath(typeId: string): string {
  return `${MEASUREMENTS_PATH}/${typeId}`;
}

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function firstValidationMessage<T>(error: z.ZodError<T>): string {
  const { fieldErrors, formErrors } = z.flattenError(error);
  for (const messages of Object.values(fieldErrors) as Array<string[] | undefined>) {
    if (messages !== undefined && messages.length > 0) return messages[0];
  }
  return formErrors[0] ?? GENERIC_FAILURE;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Create a measurement type ("Waist", "cm"). */
export async function createMeasurementType(
  prevState: MeasurementFormState,
  formData: FormData,
): Promise<MeasurementFormState> {
  const user = await getCurrentUser();

  const values = {
    name: readField(formData, "name"),
    unit: readField(formData, "unit"),
  };

  const parsed = createMeasurementTypeSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  try {
    const highest = await prisma.measurementType.aggregate({
      where: { userId: user.id },
      _max: { position: true },
    });

    await prisma.measurementType.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        unit: parsed.data.unit,
        position: (highest._max.position ?? -1) + 1,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = "You already track a measurement with that name.";
      return { status: "error", message, fieldErrors: { name: [message] }, values };
    }

    console.error("Failed to create measurement type:", error);
    return { status: "error", message: GENERIC_FAILURE, values };
  }

  revalidatePath(MEASUREMENTS_PATH);

  return { status: "success", message: "Measurement added.", values: { name: "", unit: "" } };
}

/**
 * Log a reading.
 *
 * Upserts on `(typeId, date)`: re-entering today's waist should correct it, not
 * create a second reading for the same day (the unique constraint would reject
 * that anyway, with a much worse message).
 */
export async function logMeasurement(input: {
  typeId: string;
  date: string;
  value: string;
}): Promise<MeasurementMutationResult> {
  const parsed = measurementEntrySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const type = await prisma.measurementType.findFirst({
      where: { id: parsed.data.typeId, userId: user.id, archivedAt: null },
      select: { id: true },
    });

    if (type === null) {
      return { ok: false, message: "Measurement not found." };
    }

    const date = parseIsoDate(parsed.data.date);

    await prisma.measurementEntry.upsert({
      where: { typeId_date: { typeId: type.id, date } },
      create: { typeId: type.id, date, value: parsed.data.value },
      update: { value: parsed.data.value },
    });

    revalidatePath(MEASUREMENTS_PATH);
    revalidatePath(measurementPath(type.id));
  } catch (error) {
    console.error("Failed to log measurement:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}

/** Delete one reading. */
export async function deleteMeasurementEntry(
  id: string,
): Promise<MeasurementMutationResult> {
  const parsed = measurementEntryIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    const entry = await prisma.measurementEntry.findFirst({
      where: { id: parsed.data.id, type: { userId: user.id } },
      select: { typeId: true },
    });

    if (entry === null) {
      return { ok: false, message: "Reading not found." };
    }

    await prisma.measurementEntry.deleteMany({
      where: { id: parsed.data.id, typeId: entry.typeId },
    });

    revalidatePath(measurementPath(entry.typeId));
    revalidatePath(MEASUREMENTS_PATH);
  } catch (error) {
    console.error("Failed to delete measurement entry:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true };
}

/** Archive a measurement type and, by cascade, its readings. */
export async function deleteMeasurementType(
  typeId: string,
): Promise<MeasurementMutationResult> {
  const parsed = measurementTypeIdSchema.safeParse({ typeId });

  if (!parsed.success) {
    return { ok: false, message: firstValidationMessage(parsed.error) };
  }

  const user = await getCurrentUser();

  try {
    // Soft delete: `archivedAt` keeps the readings in the database while hiding
    // the type. Hard-deleting would take the history with it, and there is no
    // undo for that.
    const archived = await prisma.measurementType.updateMany({
      where: { id: parsed.data.typeId, userId: user.id, archivedAt: null },
      data: { archivedAt: new Date() },
    });

    if (archived.count === 0) {
      return { ok: false, message: "Measurement not found." };
    }
  } catch (error) {
    console.error("Failed to archive measurement type:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  revalidatePath(MEASUREMENTS_PATH);
  revalidatePath(measurementPath(parsed.data.typeId));

  return { ok: true };
}
