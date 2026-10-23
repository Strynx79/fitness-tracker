import { WEEKDAYS } from "@/lib/weekdays";

const SHORT_BY_INDEX = new Map(WEEKDAYS.map((day) => [day.index, day.short]));

/** Monday-first ordering: Mon = 0 … Sun = 6. */
function mondayFirst(index: number): number {
  return (index + 6) % 7;
}

/**
 * "Mon · Wed · Fri", or `null` for a routine with no scheduled days.
 *
 * The words stay abbreviated outside sentence copy, and callers set them in
 * mono alongside the counts. Returning `null` rather than an empty string forces
 * the caller to decide what a missing schedule looks like (a grey em dash in the
 * table, "Not scheduled" in a header).
 */
export function formatWeekdays(weekdays: number[]): string | null {
  if (weekdays.length === 0) return null;

  return [...weekdays]
    .sort((a, b) => mondayFirst(a) - mondayFirst(b))
    .map((index) => SHORT_BY_INDEX.get(index) ?? "?")
    .join(" · ");
}

/** "1 routine" / "5 routines". */
export function formatRoutineCount(count: number): string {
  return `${count} ${count === 1 ? "routine" : "routines"}`;
}
