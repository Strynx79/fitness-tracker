/**
 * Display helpers for workout values.
 *
 * Every formatter is pure and takes an explicit IANA `timeZone`. Nothing in
 * this module reads the machine clock or the browser's default zone: the server
 * passes `user.timezone` down, so a phone set to another zone still shows the
 * session times the user actually trained.
 */

const NUMBER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

/**
 * `90 kg`, or "Bodyweight" for a stored `0`.
 *
 * `0` is a real weight (pull-ups, dips) and is the top set whenever it is the
 * only load — it must never render blank or as a missing value.
 */
export function formatWeight(weightKg: number): string {
  return weightKg === 0 ? "Bodyweight" : `${NUMBER.format(weightKg)} kg`;
}

/** `null` means "left unrated", which is different from a zero RPE. */
export function formatRpe(rpe: number | null): string {
  return rpe === null ? "—" : NUMBER.format(rpe);
}

function formatWith(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(
    new Date(iso),
  );
}

/** "Tue, Oct 14" — the short label the overload callout is built around. */
export function formatShortDate(iso: string, timeZone: string): string {
  return formatWith(iso, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Tue, Oct 14, 6:00 PM" — an instant the user can place in their day. */
export function formatInstant(iso: string, timeZone: string): string {
  return formatWith(iso, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "Sat, Oct 24" for a calendar date (`YYYY-MM-DD`).
 *
 * Formatted in UTC on purpose: a `DATE` column has no time, so applying the
 * user's zone would shift "Saturday" to Friday for anyone west of Greenwich.
 * `parseIsoDate` already anchors the value at UTC midnight.
 */
export function formatCalendarDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}
