import { parseIsoDate } from "@/lib/date";

/**
 * Number and date display for the measurements screens.
 *
 * Values are stored to two decimals, but a tape reading is read at a glance
 * between sets, so one decimal is the house precision here (the same rule the
 * metrics screen applies to kilograms). The formatters are the only place that
 * decides precision, so the list, the figure and the history cannot disagree.
 */

const ONE_DECIMAL = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  // Dates are date-only strings pinned at UTC midnight; formatting them in the
  // runtime's zone would print the previous day west of UTC.
  timeZone: "UTC",
});

const MS_PER_DAY = 86_400_000;

/** `82.5` → "82.5"; `1024.25` → "1,024.3". Always exactly one decimal. */
export function formatValue(value: number): string {
  return ONE_DECIMAL.format(value);
}

/** The same rounding rule as the formatters, for choosing a colour. */
export function roundTenths(value: number): number {
  return Number(value.toFixed(1));
}

/**
 * A signed change: "+1.2", "−0.4", or "0.0".
 *
 * U+2212 rather than a hyphen so the minus lines up with the plus in a tabular
 * column. A value that rounds to zero loses its sign: "−0.0" would claim a
 * direction the shown precision cannot support.
 */
export function formatChange(value: number): string {
  const rounded = roundTenths(value);

  if (rounded === 0) {
    return ONE_DECIMAL.format(0);
  }

  return `${rounded > 0 ? "+" : "−"}${ONE_DECIMAL.format(Math.abs(rounded))}`;
}

/** Whole days from `isoDate` to `today`; negative when the reading is ahead. */
export function daysBetween(isoDate: string, today: string): number {
  return Math.round(
    (parseIsoDate(today).getTime() - parseIsoDate(isoDate).getTime()) / MS_PER_DAY,
  );
}

/**
 * Recent days read in words ("Today", "Yesterday", "Sat, Oct 18"); anything
 * older falls back to the ISO date, which is shorter to scan in a table and
 * unambiguous across months.
 */
export function formatDateLabel(
  isoDate: string,
  today: string,
): { label: string; isIso: boolean } {
  const days = daysBetween(isoDate, today);

  if (days === 0) return { label: "Today", isIso: false };
  if (days === 1) return { label: "Yesterday", isIso: false };
  if (days > 1 && days < 7) {
    return { label: WEEKDAY_DATE.format(parseIsoDate(isoDate)), isIso: false };
  }

  return { label: isoDate, isIso: true };
}

/**
 * The tail of a sentence about a reading: "today", "12 days ago".
 *
 * A date in the future is printed as the ISO date instead of "-3 days ago":
 * the log form accepts any valid calendar date, and the screen must not
 * describe a reading that has not happened as if it were recent.
 */
export function describeRecency(isoDate: string, today: string): string {
  const days = daysBetween(isoDate, today);

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 1) return `${days} days ago`;

  return `on ${isoDate}`;
}
