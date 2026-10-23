import { isoDateInZone, parseIsoDate } from "@/lib/date";

/**
 * Display helpers shared by the workout list and the session detail.
 *
 * Every value here is derived from data the DTO already carries. Dates that
 * come from a `DATE` column are formatted at UTC midnight; timestamps are first
 * resolved to a calendar day in the user's own zone, exactly like the rest of
 * the app.
 */

const MS_PER_DAY = 86_400_000;

const SHORT_WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const LONG_WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "UTC",
});

const LONG_DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** One decimal, grouped: `90.0`, `3,113.0`. */
const KG = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** The calendar day an instant fell on, in the user's timezone. */
export function sessionDay(isoInstant: string, timeZone: string): string {
  return isoDateInZone(new Date(isoInstant), timeZone);
}

/** Whole days from `fromIsoDate` to `toIsoDate`; negative when `from` is later. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round(
    (parseIsoDate(toIsoDate).getTime() - parseIsoDate(fromIsoDate).getTime()) /
      MS_PER_DAY,
  );
}

/**
 * A history row's date: words for the last week, ISO once it stops being
 * "recent". The ISO form is narrower to scan in a column and unambiguous across
 * months.
 */
export function formatHistoryDate(
  isoDate: string,
  today: string,
): { label: string; isIso: boolean } {
  const days = daysBetween(isoDate, today);

  if (days === 0) return { label: "Today", isIso: false };
  if (days === 1) return { label: "Yesterday", isIso: false };
  if (days > 1 && days < 7) {
    return { label: SHORT_WEEKDAY_DATE.format(parseIsoDate(isoDate)), isIso: false };
  }

  return { label: isoDate, isIso: true };
}

/** "Friday, 23 October" for a `YYYY-MM-DD` calendar day. */
export function formatLongDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${LONG_WEEKDAY.format(date)}, ${LONG_DAY_MONTH.format(date)}`;
}

/** `90.0` — the unit belongs in the column header or the KPI caption. */
export function formatKgDecimal(value: number): string {
  return KG.format(value);
}

/**
 * The header's one fact about the account's training: how long ago the last
 * finished session was. `lastCompletedAtIso` is an instant, so it is resolved
 * to a day in the user's zone before the difference is taken.
 */
export function describeLastSession(
  lastCompletedAtIso: string,
  timeZone: string,
  today: string,
): string {
  const days = daysBetween(sessionDay(lastCompletedAtIso, timeZone), today);

  if (days <= 0) return "Last session today.";
  if (days === 1) return "Last session yesterday.";
  return `Last session ${days} days ago.`;
}
