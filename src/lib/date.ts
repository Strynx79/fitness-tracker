/**
 * The single chokepoint for date-only values.
 *
 * Postgres `date` columns (Prisma `DateTime @db.Date`) hold a calendar date with
 * no time or timezone. Prisma maps them to a JS `Date` pinned at UTC midnight.
 *
 * The trap: a value read back is `2026-10-18T00:00:00.000Z`. Calling
 * `.getDate()` or `.toLocaleDateString()` on it returns the PREVIOUS day in any
 * UTC-negative region (and on any server not running in UTC). So:
 *
 *   - write:  never send `new Date()`; parse a `YYYY-MM-DD` string here
 *   - read:   never `toLocaleDateString()`; format with `toIsoDate` here
 *   - "today": derive from the user's timezone, not the server clock
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;

/** True when `value` is a real `YYYY-MM-DD` calendar date (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Parse `YYYY-MM-DD` into a Date pinned at UTC midnight. Throws if invalid. */
export function parseIsoDate(value: string): Date {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid calendar date: "${value}" (expected YYYY-MM-DD)`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

/** Format a Date as `YYYY-MM-DD` using its UTC components. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format an instant as `YYYY-MM-DD` in the given IANA timezone.
 *
 * Use this for any timestamp that belongs to a user's calendar day — e.g.
 * `habit.createdAt`, which is a `timestamptz`. `toIsoDate` formats in UTC and
 * would put a habit created at 01:00 IST on the previous day, skewing any
 * "days since creation" calculation.
 */
export function isoDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's calendar date in the given IANA timezone (e.g. "Asia/Kolkata"). */
export function todayIso(timeZone: string): string {
  return isoDateInZone(new Date(), timeZone);
}

/**
 * Shift an ISO date by whole days.
 *
 * Arithmetic runs on UTC-midnight instants, so DST transitions can never
 * introduce a 23- or 25-hour day and break streak calculations.
 */
export function addDays(isoDate: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new Error(`addDays expects whole days, received ${days}`);
  }
  const shifted = new Date(parseIsoDate(isoDate).getTime() + days * MS_PER_DAY);
  return toIsoDate(shifted);
}

/** Roughly 10 years; guards against an unvalidated range end spinning the loop. */
const MAX_RANGE_DAYS = 3660;

/** Inclusive list of ISO dates from `startIso` to `endIso`. */
export function isoDateRange(startIso: string, endIso: string): string[] {
  // Both ends are validated up front. Without this, comparing raw strings lets
  // a garbage end like "abc" satisfy `cursor <= endIso` and spin for millions of
  // iterations (allocating a string per day) before `addDays` finally throws.
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) {
    throw new Error(`Invalid date range: "${startIso}" to "${endIso}"`);
  }

  const days: string[] = [];
  for (let cursor = startIso; cursor <= endIso; cursor = addDays(cursor, 1)) {
    days.push(cursor);
    if (days.length > MAX_RANGE_DAYS) {
      throw new Error(
        `Date range exceeds ${MAX_RANGE_DAYS} days: "${startIso}" to "${endIso}"`,
      );
    }
  }
  return days;
}

/**
 * The weekday (0 = Sunday … 6 = Saturday) of an instant in a given zone.
 *
 * Routines are planned per weekday, so "is this Push day?" has to be answered in
 * the user's calendar, not the server's. `Intl` with `en-US` gives a stable
 * three-letter name to map from, which avoids `getDay()`'s local-time trap.
 */
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function weekdayInZone(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);

  return WEEKDAY_INDEX[short] ?? 0;
}
