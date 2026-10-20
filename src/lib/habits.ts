import "server-only";

import {
  addDays,
  isoDateInZone,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "@/lib/date";
import {
  computeHabitStats,
  STREAK_WINDOW_DAYS,
  type HabitDay,
} from "@/lib/habit-stats";
import { prisma } from "@/lib/db";

/**
 * Read model for the habit checklist.
 *
 * Like `@/lib/daily-metrics`, everything leaving this module is JSON-safe: dates
 * are `YYYY-MM-DD` strings, never `Date` objects. A `Date` from a `@db.Date`
 * column is pinned at UTC midnight, so letting one reach a Client Component
 * reintroduces the off-by-one-day bug that `@/lib/date` exists to prevent.
 *
 * The streak/rate arithmetic itself lives in `@/lib/habit-stats` (pure, no
 * `server-only`) so it can be unit-tested; this module only fetches and shapes.
 */

export type { HabitDay };

export type HabitWithStats = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Current streak in days, with the grace rule applied (see habit-stats). */
  streak: number;
  /** True when the streak filled the whole fetch window, so the UI can say "365+". */
  streakCapped: boolean;
  /** Integer 0..100 over the last 7 days, with the capped denominator. */
  completionRate7d: number;
  /** Exactly 7 entries, OLDEST first, ending today. */
  last7Days: HabitDay[];
  checkedToday: boolean;
};

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

  return habits.map((habit) => {
    const dates = logsByHabit.get(habit.id) ?? new Set<string>();

    return {
      id: habit.id,
      name: habit.name,
      description: habit.description,
      sortOrder: habit.sortOrder,
      ...computeHabitStats({
        today,
        completedDates: dates,
        // `createdAt` is a `timestamptz`, so it must be formatted in the USER's
        // timezone — `toIsoDate` formats in UTC and would put a habit created at
        // 01:00 IST on the previous UTC day, inflating `daysAlive` and making a
        // perfect first day display 50%.
        createdLocalDate: isoDateInZone(habit.createdAt, timeZone),
      }),
      checkedToday: dates.has(today),
    };
  });
}
