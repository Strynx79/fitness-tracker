import "server-only";

import {
  addDays,
  isoDateInZone,
  isoDateRange,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "@/lib/date";
import { prisma } from "@/lib/db";

/**
 * Read model for the habit checklist.
 *
 * Like `@/lib/daily-metrics`, everything leaving this module is JSON-safe: dates
 * are `YYYY-MM-DD` strings, never `Date` objects. A `Date` from a `@db.Date`
 * column is pinned at UTC midnight, so letting one reach a Client Component
 * reintroduces the off-by-one-day bug that `@/lib/date` exists to prevent.
 */

/** One square in a habit's 7-day strip. */
export type HabitDay = {
  date: string; // "YYYY-MM-DD"
  completed: boolean;
};

export type HabitWithStats = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Current streak in days, with the grace rule applied (see below). */
  streak: number;
  /** True when the streak filled the whole fetch window, so the UI can say "365+". */
  streakCapped: boolean;
  /** Integer 0..100 over the last 7 days, with the capped denominator. */
  completionRate7d: number;
  /** Exactly 7 entries, OLDEST first, ending today. */
  last7Days: HabitDay[];
  checkedToday: boolean;
};

const MS_PER_DAY = 86_400_000;

/** How far back logs are fetched to compute a streak. */
const STREAK_WINDOW_DAYS = 365;

/** Length of the completion-rate window, in days, inclusive of today. */
const RATE_WINDOW_DAYS = 7;

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
function daysBetween(fromIso: string, toIso: string): number {
  return (parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / MS_PER_DAY;
}

/**
 * The active checklist plus per-habit streak/rate stats.
 *
 * Uses exactly two queries regardless of how many habits the user has: one for
 * the habit definitions and one for every log row in the streak window. A
 * per-habit query would be an N+1 that grows with the checklist.
 */
export async function getHabitChecklist(
  userId: string,
  timeZone: string,
): Promise<HabitWithStats[]> {
  // "Today" comes from the user's timezone, never the server clock: at 23:30 in
  // Asia/Kolkata the server (UTC) is still on yesterday, and the whole checklist
  // would be showing the wrong day.
  const today = todayIso(timeZone);

  // Query 1 — the habit definitions. Archived habits are excluded here and only
  // here: `archivedAt: null` is the whole lifecycle filter, and the composite
  // index on (userId, archivedAt) backs it.
  const habits = await prisma.habit.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  // No habits means nothing to join logs against; skip query 2 entirely.
  if (habits.length === 0) return [];

  const rateWindowStart = addDays(today, -(RATE_WINDOW_DAYS - 1));
  const streakWindowStart = addDays(today, -(STREAK_WINDOW_DAYS - 1));

  // Query 2 — every completed log in the streak window for all of these habits
  // at once. `completed: true` in the WHERE clause (not a JS filter) keeps
  // unchecked rows from being transferred: the `completed: false` rows the UI
  // writes when a box is unticked are history, not completion.
  const logs = await prisma.habitLog.findMany({
    where: {
      habitId: { in: habits.map((habit) => habit.id) },
      completed: true,
      // Both ends parsed into UTC-midnight instants, which is how a `@db.Date`
      // column stores them; `lte: today` excludes any future backfill.
      date: {
        gte: parseIsoDate(streakWindowStart),
        lte: parseIsoDate(today),
      },
    },
    select: { habitId: true, date: true },
  });

  // Grouped in JS into `habitId -> Set<"YYYY-MM-DD">`. A set makes both the
  // streak walk and the 7-day filter O(1) per day.
  const logsByHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    const dates = logsByHabit.get(log.habitId);
    const isoDate = toIsoDate(log.date);
    if (dates === undefined) logsByHabit.set(log.habitId, new Set([isoDate]));
    else dates.add(isoDate);
  }

  const rateWindow = isoDateRange(rateWindowStart, today);

  return habits.map((habit) => {
    const dates = logsByHabit.get(habit.id) ?? new Set<string>();

    // --- Current streak, with the grace rule ---------------------------
    //
    // The anchor is today when today is ticked, otherwise yesterday. Without
    // that fallback every streak collapses to 0 at midnight and only comes back
    // once the user ticks today's box — a habit done 400 days straight would
    // read "0 day streak" every morning. The streak is only broken when NEITHER
    // today nor yesterday is ticked.
    const anchor = dates.has(today)
      ? today
      : dates.has(addDays(today, -1))
        ? addDays(today, -1)
        : null;

    let streak = 0;
    let streakCapped = false;

    if (anchor !== null) {
      // Walk backwards day by day while the date is present. The walk can never
      // run past the fetched window, so `streak` is a lower bound when it stops
      // at the boundary.
      let cursor = anchor;
      while (dates.has(cursor)) {
        streak += 1;
        if (cursor === streakWindowStart) break;
        cursor = addDays(cursor, -1);
      }

      // The walk stopped at the window edge only if every day from the window
      // start through the anchor is ticked; that is exactly when the count
      // equals the span. The UI renders "365+" instead of an under-reported 365.
      const anchorSpan = daysBetween(streakWindowStart, anchor) + 1;
      streakCapped = streak === anchorSpan;
    }

    // --- 7-day completion rate, with the capped denominator ------------
    //
    // The denominator is the days the habit has actually existed, not a flat 7
    // (the creation day itself counts as one of them). A habit created yesterday
    // and completed on both days it has existed must read 100%; dividing by 7
    // would report 29% and make a perfect start look like a failure.
    const completedInWindow = rateWindow.reduce(
      (count, date) => (dates.has(date) ? count + 1 : count),
      0,
    );

    // `createdAt` is a `timestamptz`, so it must be formatted in the USER's
    // timezone — `toIsoDate` formats in UTC and would put a habit created at
    // 01:00 IST on the previous UTC day, inflating `daysAlive` and making a
    // perfect first day display 50%. Do not "simplify" this to `toIsoDate`.
    const createdLocal = isoDateInZone(habit.createdAt, timeZone);

    // `max(1, ...)`: a habit created today has daysAlive 1, and clock skew that
    // puts `createdAt` slightly in the future must not yield a 0 denominator.
    const daysAlive = Math.max(1, daysBetween(createdLocal, today) + 1);
    const denominator = Math.min(RATE_WINDOW_DAYS, daysAlive);
    const completionRate7d = Math.round((completedInWindow / denominator) * 100);

    return {
      id: habit.id,
      name: habit.name,
      description: habit.description,
      sortOrder: habit.sortOrder,
      streak,
      streakCapped,
      completionRate7d,
      // Always exactly 7 entries, oldest first, gaps filled with `completed:
      // false` so the strip stays contiguous.
      last7Days: rateWindow.map((date) => ({
        date,
        completed: dates.has(date),
      })),
      checkedToday: dates.has(today),
    };
  });
}
