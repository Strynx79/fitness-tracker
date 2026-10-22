/**
 * Weekday constants shared by Client and Server Components.
 *
 * Deliberately NOT in `@/lib/routines`: that module is `server-only` and imports
 * Prisma, so a Client Component importing these labels would drag the database
 * client into the browser bundle (and fail the build).
 */
export const WEEKDAYS: ReadonlyArray<{ index: number; short: string; label: string }> = [
  { index: 1, short: "Mon", label: "Monday" },
  { index: 2, short: "Tue", label: "Tuesday" },
  { index: 3, short: "Wed", label: "Wednesday" },
  { index: 4, short: "Thu", label: "Thursday" },
  { index: 5, short: "Fri", label: "Friday" },
  { index: 6, short: "Sat", label: "Saturday" },
  { index: 0, short: "Sun", label: "Sunday" },
];
