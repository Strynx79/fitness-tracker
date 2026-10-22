import "server-only";

import { prisma } from "@/lib/db";
import { addDays, toIsoDate, todayIso } from "@/lib/date";

/**
 * Body measurements — user-defined types (Waist, Chest, Left arm …), each with
 * its own unit and a history of readings.
 *
 * Values cross the boundary as plain numbers: `Decimal` cannot be passed to a
 * Client Component, and the chart is one.
 */

export type MeasurementTypeSummary = {
  id: string;
  name: string;
  unit: string;
  latestValue: number | null;
  latestDateIso: string | null;
  /** Latest minus the reading before it; `null` with fewer than two readings. */
  changeFromPrevious: number | null;
  entryCount: number;
};

/** One reading, ascending by date, for the chart. */
export type MeasurementPoint = { id: string; date: string; value: number };

export type MeasurementDetail = {
  id: string;
  name: string;
  unit: string;
  points: MeasurementPoint[];
};

/** Every live measurement type, with its two most recent readings. */
export async function getMeasurementTypes(
  userId: string,
): Promise<MeasurementTypeSummary[]> {
  const rows = await prisma.measurementType.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      unit: true,
      _count: { select: { entries: true } },
      // Two, not one: the delta needs the reading before the latest. A nested
      // `take` keeps this a single query instead of an N+1 per type.
      entries: {
        orderBy: { date: "desc" },
        take: 2,
        select: { date: true, value: true },
      },
    },
  });

  return rows.map((row) => {
    const [latest, previous] = row.entries;
    const latestValue = latest === undefined ? null : latest.value.toNumber();
    const previousValue = previous === undefined ? null : previous.value.toNumber();

    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      latestValue,
      latestDateIso: latest === undefined ? null : toIsoDate(latest.date),
      changeFromPrevious:
        latestValue === null || previousValue === null
          ? null
          : Number((latestValue - previousValue).toFixed(2)),
      entryCount: row._count.entries,
    };
  });
}

/** One type with its readings inside a window, ascending for the chart. */
export async function getMeasurement(
  userId: string,
  typeId: string,
  days = 120,
): Promise<MeasurementDetail | null> {
  const type = await prisma.measurementType.findFirst({
    where: { id: typeId, userId, archivedAt: null },
    select: { id: true, name: true, unit: true },
  });

  if (type === null) return null;

  const since = addDays(todayIso("UTC"), -days);

  const entries = await prisma.measurementEntry.findMany({
    where: { typeId: type.id, date: { gte: new Date(`${since}T00:00:00.000Z`) } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, value: true },
  });

  return {
    id: type.id,
    name: type.name,
    unit: type.unit,
    points: entries.map((entry) => ({
      id: entry.id,
      date: toIsoDate(entry.date),
      value: entry.value.toNumber(),
    })),
  };
}
