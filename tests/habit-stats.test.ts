import assert from "node:assert/strict";
import { test } from "node:test";

import { addDays } from "@/lib/date";
import {
  computeHabitStats,
  RATE_WINDOW_DAYS,
  type HabitStats,
} from "@/lib/habit-stats";

const TODAY = "2026-10-20";

/** A habit older than every window, so its creation date never interferes. */
const OLD_CREATED = "2025-01-01";

function compute(
  dates: readonly string[],
  createdLocalDate: string = OLD_CREATED,
): HabitStats {
  return computeHabitStats({
    today: TODAY,
    completedDates: new Set(dates),
    createdLocalDate,
  });
}

/** The `count` ISO dates ending at `endIso`, oldest first. */
function consecutive(endIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    addDays(endIso, index - (count - 1)),
  );
}

test("grace rule: checking only yesterday keeps the streak alive (1, not 0)", () => {
  const stats = compute([addDays(TODAY, -1)]);

  assert.equal(stats.streak, 1);
  assert.equal(stats.streakCapped, false);
});

test("a run ending yesterday reports its full length", () => {
  assert.equal(compute(consecutive(addDays(TODAY, -1), 6)).streak, 6);
});

test("checking today extends a run that ended yesterday", () => {
  const endingYesterday = consecutive(addDays(TODAY, -1), 6);
  const throughToday = [...endingYesterday, TODAY];

  assert.equal(compute(endingYesterday).streak, 6);
  assert.equal(compute(throughToday).streak, 7);
});

test("a gap stops the count", () => {
  const stats = compute([TODAY, addDays(TODAY, -1), addDays(TODAY, -3)]);

  assert.equal(stats.streak, 2);
});

test("completions that ended more than a day ago do not form a streak", () => {
  assert.equal(compute([addDays(TODAY, -10), addDays(TODAY, -11)]).streak, 0);
});

test("an empty set is 0 streak, 0% and seven unchecked days", () => {
  const stats = compute([]);

  assert.equal(stats.streak, 0);
  assert.equal(stats.streakCapped, false);
  assert.equal(stats.completionRate7d, 0);
  assert.equal(stats.last7Days.length, 7);
  assert.deepEqual(
    stats.last7Days.map((day) => day.completed),
    [false, false, false, false, false, false, false],
  );
});

test("capped denominator: created today and checked today is 100%", () => {
  const stats = compute([TODAY], TODAY);

  assert.equal(stats.completionRate7d, 100);
});

test("capped denominator: created 2 days ago and checked all 3 days is 100%", () => {
  const created = addDays(TODAY, -2);
  const stats = compute(consecutive(TODAY, 3), created);

  assert.equal(stats.completionRate7d, 100);
});

test("capped denominator: a week-old habit is scored out of 7, not out of days alive", () => {
  // 8 days alive but only the 7-day window can count. Without the
  // `Math.min(RATE_WINDOW_DAYS, daysAlive)` clamp this is 7/8 = 88.
  const created = addDays(TODAY, -7);
  const stats = compute(consecutive(TODAY, 7), created);

  assert.equal(stats.completionRate7d, 100);
});

test("completionRate7d is a rounded integer, not a repeating fraction", () => {
  // 1 of 3 days = 33.33…%. Without `Math.round` the stored value is 33.333…
  // instead of the integer 0..100 the UI and type contract promise.
  const created = addDays(TODAY, -2);
  const stats = compute([TODAY], created);

  assert.equal(stats.completionRate7d, 33);
  assert.ok(Number.isInteger(stats.completionRate7d));
});

test("FIX 0: a completion before creation does not push the rate over 100", () => {
  // The production path: toggleHabit accepts a date before the habit existed.
  // Created Oct 19 and checked Oct 18-20 => numerator must be 2 of 2, not 3 of 2
  // (the pre-refactor bug reported 150).
  const created = addDays(TODAY, -1);
  const stats = compute([addDays(TODAY, -2), addDays(TODAY, -1), TODAY], created);

  assert.equal(stats.completionRate7d, 100);
});

test("FIX 0: a pre-creation completion is excluded, not clamped away", () => {
  // Created yesterday, checked the day before creation and yesterday, not today.
  // The lifetime intersection gives 1 of 2 = 50%. A post-hoc `Math.min(100, …)`
  // would instead count both completions and report 100%, hiding the bug.
  const created = addDays(TODAY, -1);
  const stats = compute([addDays(TODAY, -2), addDays(TODAY, -1)], created);

  assert.equal(stats.completionRate7d, 50);
});

test("last7Days shows raw logged truth for a pre-creation completion", () => {
  // The strip and the rate deliberately disagree here: the pre-creation day is
  // real logged history, but it is outside the habit's lifetime for scoring.
  const created = addDays(TODAY, -1);
  const preCreation = addDays(TODAY, -2);
  const stats = compute([preCreation, created], created);
  const day = stats.last7Days.find((entry) => entry.date === preCreation);

  assert.equal(day?.completed, true);
  assert.equal(stats.completionRate7d, 50);
});

test("FIX 0: several pre-creation completions cannot double the rate", () => {
  // Created Oct 17, checked all 4 days it existed PLUS four days before it
  // existed. Without the lifetime intersection this is 8/4 = 200.
  const created = addDays(TODAY, -3);
  const beforeCreation = consecutive(addDays(created, -1), 3);
  const stats = compute([...beforeCreation, ...consecutive(TODAY, 4)], created);

  assert.equal(stats.completionRate7d, 100);
});

test("FIX 0: a habit created today ignores the six prior days", () => {
  const priorDays = consecutive(addDays(TODAY, -1), 6);
  const stats = compute([...priorDays, TODAY], TODAY);

  assert.equal(stats.completionRate7d, 100);
});

test("last7Days is always 7 ascending dates ending today", () => {
  const stats = compute([TODAY, addDays(TODAY, -3)]);

  assert.equal(stats.last7Days.length, 7);
  // Hardcoded, not derived from the production `isoDateRange`/`addDays`, so a
  // bug in the window construction cannot make the expectation agree with it.
  assert.deepEqual(
    stats.last7Days.map((day) => day.date),
    [
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ],
  );
  assert.deepEqual(
    stats.last7Days.map((day) => day.completed),
    [false, false, false, true, false, false, true],
  );
});

test("RATE_WINDOW_DAYS is the length of the rate window and of last7Days", () => {
  // Kept exported because it is part of the module's contract; this pins it.
  assert.equal(RATE_WINDOW_DAYS, 7);
  assert.equal(compute([]).last7Days.length, RATE_WINDOW_DAYS);
});

test("streakCapped is true only when the run fills the whole window", () => {
  const fullWindow = consecutive(TODAY, 365);
  const oneShort = consecutive(TODAY, 364);

  const capped = compute(fullWindow);
  assert.equal(capped.streak, 365);
  assert.equal(capped.streakCapped, true);

  const notCapped = compute(oneShort);
  assert.equal(notCapped.streak, 364);
  assert.equal(notCapped.streakCapped, false);

  const shortRun = compute(consecutive(TODAY, 10));
  assert.equal(shortRun.streak, 10);
  assert.equal(shortRun.streakCapped, false);
});

test("a run longer than the window stops at 365 and reports capped", () => {
  // 400 consecutive days ending today. Without the
  // `if (cursor === streakWindowStart) break;` the walk returns 400 (and
  // `streakCapped` would be false); with it the answer is the window length.
  const stats = compute(consecutive(TODAY, 400));

  assert.equal(stats.streak, 365);
  assert.equal(stats.streakCapped, true);
});
