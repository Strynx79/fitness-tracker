import { addDays, isoDateRange, parseIsoDate } from "@/lib/date";

/**
 * Pure habit statistics.
 *
 * Deliberately free of `server-only`, Prisma and React: this module is the
 * behavioural contract for streaks and completion rates, and it can be exercised
 * by `node --test` without a database or Next's react-server condition.
 * `@/lib/habits` owns the queries and calls `computeHabitStats` per habit.
 */

/** One square in a habit's 7-day strip. */
export type HabitDay = {
  date: string; // "YYYY-MM-DD"
  completed: boolean;
};

export type HabitStatsInput = {
  today: string; // YYYY-MM-DD in the user's timezone
  completedDates: ReadonlySet<string>;
  createdLocalDate: string; // YYYY-MM-DD in the user's timezone
};

export type HabitStats = {
  streak: number;
  streakCapped: boolean;
  completionRate7d: number;
  last7Days: HabitDay[];
};

const MS_PER_DAY = 86_400_000;

/**
 * How far back the streak walk is allowed to run. Exported so the read model
 * fetches exactly the window this module can reason about.
 */
export const STREAK_WINDOW_DAYS = 365;

/** Length of the completion-rate window, in days, inclusive of today. */
export const RATE_WINDOW_DAYS = 7;

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
function daysBetween(fromIso: string, toIso: string): number {
  return (parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / MS_PER_DAY;
}

export function computeHabitStats(input: HabitStatsInput): HabitStats {
  const { today, completedDates: dates, createdLocalDate } = input;

  const rateWindowStart = addDays(today, -(RATE_WINDOW_DAYS - 1));
  const streakWindowStart = addDays(today, -(STREAK_WINDOW_DAYS - 1));

  // --- Current streak, with the grace rule ---------------------------
  //
  // The anchor is today when today is ticked, otherwise yesterday. Without that
  // fallback every streak collapses to 0 at midnight and only comes back once the
  // user ticks today's box — a habit done 400 days straight would read "0 day
  // streak" every morning. The streak is only broken when NEITHER today nor
  // yesterday is ticked.
  const anchor = dates.has(today)
    ? today
    : dates.has(addDays(today, -1))
      ? addDays(today, -1)
      : null;

  let streak = 0;
  let streakCapped = false;

  if (anchor !== null) {
    // Walk backwards day by day while the date is present. The walk can never run
    // past the fetched window, so `streak` is a lower bound when it stops at the
    // boundary.
    let cursor = anchor;
    while (dates.has(cursor)) {
      streak += 1;
      if (cursor === streakWindowStart) break;
      cursor = addDays(cursor, -1);
    }

    // The walk stopped at the window edge only if every day from the window start
    // through the anchor is ticked; that is exactly when the count equals the
    // span. The UI renders "365+" instead of an under-reported 365.
    const anchorSpan = daysBetween(streakWindowStart, anchor) + 1;
    streakCapped = streak === anchorSpan;
  }

  const rateWindow = isoDateRange(rateWindowStart, today);

  // --- 7-day completion rate, with the capped denominator ------------
  //
  // The denominator is the days the habit has actually existed, not a flat 7
  // (the creation day itself counts as one of them). A habit created yesterday
  // and completed on both days it has existed must read 100%; dividing by 7
  // would report 29% and make a perfect start look like a failure.
  //
  // The numerator must be bounded by the same lifetime: `toggleHabit` accepts any
  // date up to today, including one before the habit existed, and such a log is
  // counted by the streak walk but must NOT inflate the rate. Intersecting the
  // window with the habit's lifetime keeps the numerator inside the denominator
  // (hence the rate can never exceed 100) without clamping a wrong number.
  const lifetimeStart =
    createdLocalDate > rateWindowStart ? createdLocalDate : rateWindowStart;
  const completedInWindow = rateWindow.reduce(
    (count, date) => (date >= lifetimeStart && dates.has(date) ? count + 1 : count),
    0,
  );

  // `createdLocalDate` arrives already formatted in the USER's timezone, because
  // `createdAt` is a `timestamptz`: formatting it in UTC would put a habit created
  // at 01:00 IST on the previous UTC day, inflating `daysAlive` and making a
  // perfect first day display 50%. Do not "simplify" the caller to a UTC date.

  // `max(1, ...)`: a habit created today has daysAlive 1, and clock skew that puts
  // `createdAt` slightly in the future must not yield a 0 denominator.
  const daysAlive = Math.max(1, daysBetween(createdLocalDate, today) + 1);
  const denominator = Math.min(RATE_WINDOW_DAYS, daysAlive);
  const completionRate7d = Math.round((completedInWindow / denominator) * 100);

  return {
    streak,
    streakCapped,
    completionRate7d,
    // Always exactly 7 entries, oldest first, gaps filled with `completed: false`
    // so the strip stays contiguous.
    // Raw logged truth: a pre-creation completion appears here even though the rate excludes it.
    last7Days: rateWindow.map((date) => ({
      date,
      completed: dates.has(date),
    })),
  };
}
