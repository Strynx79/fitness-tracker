import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, parseIsoDate, todayIso } from "../src/lib/date";
import { DEV_USER_ID } from "../src/lib/dev-user";

// Seed runs outside Next.js (via tsx), so it builds its own client instead of
// importing src/lib/db.ts — that module resolves "@/..." aliases tsx can't see.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Fixed anchor so seeded fixtures never depend on the machine's local clock.
const SEED_TIMEZONE = "Asia/Kolkata";

type DailyMetricFixture = {
  weightKg: number | null;
  calories: number | null;
  proteinG: number | null;
  notes: string | null;
};

/**
 * 30 days of history, oldest first; the last entry is TODAY.
 *
 * Deliberately exercises every nullable path the UI has to render:
 *   - a ~82.4 → ~79.8 kg downward trend with a 4-day plateau (days 15–18) and
 *     one overnight water-weight spike (day 9)
 *   - 3 macro-only days (weightKg null: days 6, 13, 22)
 *   - 2 weigh-in-only days (calories + proteinG null: days 5, 19)
 *   - 1 day with a real `calories: 0` (day 1) — the exact case the empty-string
 *     preprocessor in src/lib/validations/daily-metric.ts protects against
 *   - 1 day with long multi-line notes (day 11) to exercise TEXT rendering
 */
const DAILY_METRIC_FIXTURES: DailyMetricFixture[] = [
  // Day 1 — fasted day: a legitimately logged zero, not a missing value.
  { weightKg: 82.4, calories: 0, proteinG: 0, notes: null },
  { weightKg: 82.1, calories: 2150, proteinG: 165, notes: null },
  { weightKg: 82.3, calories: 2050, proteinG: 160, notes: null },
  { weightKg: 82.0, calories: 1980, proteinG: 150, notes: null },
  // Day 5 — weigh-in only: no macros logged.
  { weightKg: 81.9, calories: null, proteinG: null, notes: null },
  // Day 6 — macro-only: no weigh-in.
  { weightKg: null, calories: 2200, proteinG: 170, notes: null },
  { weightKg: 81.8, calories: 2100, proteinG: 158, notes: null },
  { weightKg: 81.6, calories: 1890, proteinG: 145, notes: null },
  // Day 9 — overnight water-weight spike after a high-sodium day.
  { weightKg: 82.4, calories: 2350, proteinG: 175, notes: null },
  { weightKg: 81.7, calories: 2000, proteinG: 155, notes: null },
  { weightKg: 81.5, calories: 1950, proteinG: 160, notes: null },
  // Day 12 — long multi-line notes.
  {
    weightKg: 81.4,
    calories: 1950,
    proteinG: 160,
    notes: [
      "Felt strong today — sleep was 7h40m and I hit every set with 2 reps in reserve.",
      "Notes to self:",
      "• Bench moved to 72.5 kg without grinding.",
      "• Left knee was quiet on squats for the first time in two weeks.",
      "• Sodium was high at dinner (ramen), so expect a scale bump tomorrow.",
      "Plan for tomorrow: keep protein at 160 g, walk 8k steps, and get to bed before 23:00.",
    ].join("\n"),
  },
  // Day 13 — macro-only: no weigh-in.
  { weightKg: null, calories: 1900, proteinG: 150, notes: null },
  { weightKg: 81.2, calories: 2000, proteinG: 155, notes: null },
  // Days 15–18 — a 4-day plateau.
  { weightKg: 81.1, calories: 1850, proteinG: 148, notes: null },
  { weightKg: 81.1, calories: 2100, proteinG: 160, notes: null },
  { weightKg: 81.1, calories: 1950, proteinG: 152, notes: null },
  { weightKg: 81.1, calories: 2000, proteinG: 158, notes: null },
  // Day 19 — weigh-in only: no macros logged.
  { weightKg: 81.0, calories: null, proteinG: null, notes: null },
  { weightKg: 80.8, calories: 1900, proteinG: 150, notes: null },
  { weightKg: 80.7, calories: 1850, proteinG: 145, notes: null },
  // Day 22 — macro-only: no weigh-in.
  { weightKg: null, calories: 1800, proteinG: 140, notes: null },
  { weightKg: 80.4, calories: 1950, proteinG: 155, notes: null },
  { weightKg: 80.3, calories: 2000, proteinG: 160, notes: null },
  { weightKg: 80.1, calories: 1850, proteinG: 150, notes: null },
  { weightKg: 80.0, calories: 1900, proteinG: 152, notes: null },
  { weightKg: 79.9, calories: 1800, proteinG: 145, notes: null },
  { weightKg: 79.9, calories: 1950, proteinG: 158, notes: null },
  { weightKg: 79.8, calories: 1850, proteinG: 150, notes: null },
  // Day 30 — today, always present.
  { weightKg: 79.8, calories: 1900, proteinG: 155, notes: null },
];

// ---------------------------------------------------------------------------
// Slice 2 — habits (definitions + per-day logs)
// ---------------------------------------------------------------------------

/** IANA zone name for `SEED_TIMEZONE`; IST has no DST, so +05:30 is exact. */
const SEED_UTC_OFFSET_HOURS = 5.5;

/**
 * An instant that reads as `hour`:00 on `dateIso` in the seed timezone.
 *
 * `createdAt` is a `timestamptz`, so the seeded value must be built as an
 * instant, not as UTC midnight. `atLocalInstant(stepsStart, 1)` is deliberately
 * hostile: 01:00 IST is 19:30 UTC the PREVIOUS day, which is exactly the case
 * that makes `toIsoDate` over-count `daysAlive` while `isoDateInZone` (used by
 * `getHabitChecklist`) gets it right.
 */
function atLocalInstant(dateIso: string, hour: number): Date {
  return new Date(
    parseIsoDate(dateIso).getTime() +
      (hour - SEED_UTC_OFFSET_HOURS) * 60 * 60 * 1000,
  );
}

/** The `count` ISO dates ending at `endIso`, oldest first. */
function consecutiveDays(endIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    addDays(endIso, index - (count - 1)),
  );
}

type HabitFixture = {
  /** Pinned so re-running the seed targets the same row. */
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  /** Days before today; e.g. 2 means the habit is 2 days old. */
  createdDaysAgo: number;
  /** Local hour of day the habit was created at; see `atLocalInstant`. */
  createdHour?: number;
  /** Days before today the habit was archived, or null while it is active. */
  archivedDaysAgo?: number;
};

/**
 * Six fixtures, each chosen to exercise one branch of `getHabitChecklist`:
 *
 *   - `hab_seed_protein`  12 consecutive days incl. today  → streak 12, rate 100
 *   - `hab_seed_sleep`    11 consecutive days ending YESTERDAY, nothing today
 *                         → streak 11 via the grace rule (without it: 0)
 *   - `hab_seed_read`     3 of the last 7 ticked, plus 2 unticked rows
 *                         → streak 0, rate 43, and proof that unchecking
 *                           persists as a `completed: false` row
 *   - `hab_seed_steps`    created yesterday at 01:00 IST, ticked on both days it
 *                         has existed → rate 100 via the capped denominator
 *                         (a flat /7 would read 29; a UTC `createdAt` read,
 *                         67). This is the fixture that pins both traps.
 *   - `hab_seed_meditate` archived 5 days ago, logs on both sides of that
 *                         → absent from the checklist, history intact
 *   - `hab_seed_stretch`  ticked today + yesterday, then a 14-day gap
 *                         → streak resets to 2 rather than counting the gap
 */
const HABIT_FIXTURES: HabitFixture[] = [
  {
    id: "hab_seed_protein",
    name: "Hit Protein Goal",
    description: "165 g of protein, come what may.",
    sortOrder: 0,
    createdDaysAgo: 14,
  },
  {
    id: "hab_seed_sleep",
    name: "8h Sleep",
    description: "Lights out by 23:00 so the training actually counts.",
    sortOrder: 1,
    createdDaysAgo: 14,
  },
  {
    id: "hab_seed_read",
    name: "Read 20m",
    description: "Twenty minutes of a book, not a feed.",
    sortOrder: 2,
    // Older than the rate window, so the denominator is a full 7.
    createdDaysAgo: 30,
  },
  {
    id: "hab_seed_steps",
    name: "10k Steps",
    description: "Walk the long way home.",
    sortOrder: 3,
    // Younger than the rate window, and ticked on EVERY day it has existed, so
    // it must read 100%. "Created yesterday" (not two days ago) is what makes
    // `daysAlive` exactly 2: the spec's `daysBetween(created, today) + 1` counts
    // the creation day itself, so a habit created N days ago has lived N+1 days.
    createdDaysAgo: 1,
    // 01:00 IST — the case that catches UTC-vs-local `createdAt` handling:
    // `toIsoDate` would read this as two days ago (3 alive days → 67%).
    createdHour: 1,
  },
  {
    id: "hab_seed_meditate",
    name: "Meditate 10m",
    description: "Ten quiet minutes before the inbox opens.",
    sortOrder: 4,
    createdDaysAgo: 20,
    archivedDaysAgo: 5,
  },
  {
    id: "hab_seed_stretch",
    name: "Stretch",
    description: "Hips and hamstrings, every evening.",
    sortOrder: 5,
    createdDaysAgo: 40,
  },
];

/** Log fixtures just need a date and a flag; the habit id comes from the upsert. */
type HabitLogFixture = { date: string; completed: boolean };

/** Idempotent: one row per (habit, day), always the same `completed` value. */
async function seedHabitLogs(
  habitId: string,
  fixtures: HabitLogFixture[],
): Promise<number> {
  for (const fixture of fixtures) {
    const date = parseIsoDate(fixture.date);

    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date } },
      create: { habitId, date, completed: fixture.completed },
      update: { completed: fixture.completed },
    });
  }

  return fixtures.length;
}

// ---------------------------------------------------------------------------
// Slice 3 — workout sessions + logged sets
// ---------------------------------------------------------------------------

/**
 * One set row. `exerciseKey` is written explicitly (the runtime derivation lives
 * in `deriveExerciseKey` in `src/app/workouts/actions.ts`: trim, collapse
 * whitespace runs, lowercase). It is duplicated here because importing a
 * `"use server"` module into a tsx script would drag in Next's request context;
 * the fixtures below are hand-checked to hold that invariant.
 */
type WorkoutSetFixture = {
  exerciseName: string;
  exerciseKey: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
};

type WorkoutSessionFixture = {
  /** Pinned so re-running the seed upserts the same session. */
  id: string;
  name: string;
  notes: string | null;
  /** In progress: a true instant, N hours before now. */
  startedHoursAgo?: number;
  /** Completed: N days ago at `startedHour` local time. */
  startedDaysAgo?: number;
  startedHour?: number;
  /** Minutes after `startedAt`. Absent → `completedAt: null` (in progress). */
  durationMinutes?: number;
  sets: WorkoutSetFixture[];
};

/**
 * Six sessions, each chosen to exercise one branch of `getWorkoutSession`:
 *
 *   - `ws_seed_push_active`  started 3h ago and NOT completed. It must never be
 *                            picked as a "previous top set" target; the callout
 *                            for its Bench Press must come from the 5-day session
 *   - `ws_seed_push_recent`  the main target: Bench 90×5 @9.5 is the top set even
 *                            though 85×6 has more reps, plus an `rpe: null` set
 *                            and bodyweight pull-ups (`weightKg: 0`)
 *   - `ws_seed_push_older`   Bench 85×6 — the heavier-rep set that must NOT be
 *                            offered, because a newer session contains the lift
 *   - `ws_seed_pull`         bodyweight top set (0×8), and a row whose display
 *                            name is lowercase "bench press" but whose key is
 *                            canonical, so it joins the Bench Press history
 *   - `ws_seed_legs`         a 5-set squat (setNumber 1..5) and a second exercise
 *                            whose numbering restarts at 1
 *   - `ws_seed_push_oldest`  a third Push, so "the most recent earlier session"
 *                            is unambiguous rather than a two-way coin flip
 */
const WORKOUT_SESSION_FIXTURES: WorkoutSessionFixture[] = [
  {
    id: "ws_seed_push_active",
    name: "Push",
    notes: "Session still open — the last set is logging now.",
    startedHoursAgo: 3,
    sets: [
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 1,
        weightKg: 92.5,
        reps: 4,
        rpe: 9,
      },
      {
        exerciseName: "Pull-Up",
        exerciseKey: "pull-up",
        setNumber: 1,
        weightKg: 0,
        reps: 8,
        rpe: 9,
      },
    ],
  },
  {
    id: "ws_seed_push_recent",
    name: "Push",
    notes: "Felt strong. Bench moved well after the warm-up.",
    startedDaysAgo: 5,
    startedHour: 18,
    durationMinutes: 70,
    sets: [
      // Top set: heaviest wins, so 90×5 beats 85×6 on reps.
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 1,
        weightKg: 90,
        reps: 5,
        rpe: 9.5,
      },
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 2,
        weightKg: 85,
        reps: 6,
        rpe: 9,
      },
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 3,
        weightKg: 80,
        reps: 8,
        rpe: 8,
      },
      // Bodyweight sets: 0 is a real weight and ranks as the top set here,
      // because there is nothing heavier for this exercise in this session.
      {
        exerciseName: "Pull-Up",
        exerciseKey: "pull-up",
        setNumber: 1,
        weightKg: 0,
        reps: 10,
        rpe: 9,
      },
      {
        exerciseName: "Pull-Up",
        exerciseKey: "pull-up",
        setNumber: 2,
        weightKg: 0,
        reps: 8,
        rpe: 10,
      },
      // An unrated set: `rpe` is nullable and must stay `null`, not 0.
      {
        exerciseName: "Overhead Press",
        exerciseKey: "overhead press",
        setNumber: 1,
        weightKg: 55,
        reps: 8,
        rpe: null,
      },
      {
        exerciseName: "Overhead Press",
        exerciseKey: "overhead press",
        setNumber: 2,
        weightKg: 52.5,
        reps: 10,
        rpe: 9,
      },
      {
        exerciseName: "Triceps Pushdown",
        exerciseKey: "triceps pushdown",
        setNumber: 1,
        weightKg: 30,
        reps: 12,
        rpe: 9,
      },
      {
        exerciseName: "Lateral Raise",
        exerciseKey: "lateral raise",
        setNumber: 1,
        weightKg: 12.5,
        reps: 15,
        rpe: 9.5,
      },
    ],
  },
  {
    id: "ws_seed_push_older",
    name: "Push",
    notes: null,
    startedDaysAgo: 12,
    startedHour: 18,
    durationMinutes: 65,
    sets: [
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 1,
        weightKg: 85,
        reps: 6,
        rpe: 9.5,
      },
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 2,
        weightKg: 82.5,
        reps: 8,
        rpe: 9,
      },
      {
        exerciseName: "Overhead Press",
        exerciseKey: "overhead press",
        setNumber: 1,
        weightKg: 52.5,
        reps: 8,
        rpe: 9,
      },
    ],
  },
  {
    id: "ws_seed_pull",
    name: "Pull",
    notes: null,
    startedDaysAgo: 7,
    startedHour: 18,
    durationMinutes: 60,
    sets: [
      {
        exerciseName: "Pull-Up",
        exerciseKey: "pull-up",
        setNumber: 1,
        weightKg: 0,
        reps: 8,
        rpe: 8,
      },
      {
        exerciseName: "Pull-Up",
        exerciseKey: "pull-up",
        setNumber: 2,
        weightKg: 0,
        reps: 6,
        rpe: 9,
      },
      {
        exerciseName: "Pull-Up",
        exerciseKey: "pull-up",
        setNumber: 3,
        weightKg: 0,
        reps: 5,
        rpe: 10,
      },
      // Typed lowercase on purpose: the display name is preserved, but the key
      // is identical to the "Bench Press" rows, so this session counts as
      // Bench Press history (and, being older, loses to the 5-day session).
      {
        exerciseName: "bench press",
        exerciseKey: "bench press",
        setNumber: 1,
        weightKg: 70,
        reps: 10,
        rpe: 8,
      },
      {
        exerciseName: "Barbell Row",
        exerciseKey: "barbell row",
        setNumber: 1,
        weightKg: 60,
        reps: 8,
        rpe: 9,
      },
      {
        exerciseName: "Barbell Row",
        exerciseKey: "barbell row",
        setNumber: 2,
        weightKg: 60,
        reps: 8,
        rpe: 9,
      },
    ],
  },
  {
    id: "ws_seed_legs",
    name: "Legs",
    notes: "Five sets of squats, then a hinge accessory.",
    startedDaysAgo: 14,
    startedHour: 18,
    durationMinutes: 80,
    sets: [
      // setNumber runs 1..5 for the squat …
      {
        exerciseName: "Back Squat",
        exerciseKey: "back squat",
        setNumber: 1,
        weightKg: 140,
        reps: 5,
        rpe: 9.5,
      },
      {
        exerciseName: "Back Squat",
        exerciseKey: "back squat",
        setNumber: 2,
        weightKg: 135,
        reps: 5,
        rpe: 9,
      },
      {
        exerciseName: "Back Squat",
        exerciseKey: "back squat",
        setNumber: 3,
        weightKg: 130,
        reps: 5,
        rpe: 9,
      },
      {
        exerciseName: "Back Squat",
        exerciseKey: "back squat",
        setNumber: 4,
        weightKg: 125,
        reps: 5,
        rpe: 8.5,
      },
      {
        exerciseName: "Back Squat",
        exerciseKey: "back squat",
        setNumber: 5,
        weightKg: 120,
        reps: 5,
        rpe: 8,
      },
      // … and restarts at 1 for the next exercise.
      {
        exerciseName: "Romanian Deadlift",
        exerciseKey: "romanian deadlift",
        setNumber: 1,
        weightKg: 100,
        reps: 8,
        rpe: 8,
      },
      {
        exerciseName: "Romanian Deadlift",
        exerciseKey: "romanian deadlift",
        setNumber: 2,
        weightKg: 95,
        reps: 8,
        rpe: 8,
      },
      {
        exerciseName: "Romanian Deadlift",
        exerciseKey: "romanian deadlift",
        setNumber: 3,
        weightKg: 90,
        reps: 10,
        rpe: 9,
      },
    ],
  },
  {
    id: "ws_seed_push_oldest",
    name: "Push",
    notes: null,
    startedDaysAgo: 20,
    startedHour: 18,
    durationMinutes: 60,
    sets: [
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        rpe: 8,
      },
      {
        exerciseName: "Bench Press",
        exerciseKey: "bench press",
        setNumber: 2,
        weightKg: 77.5,
        reps: 10,
        rpe: 9,
      },
      {
        exerciseName: "Overhead Press",
        exerciseKey: "overhead press",
        setNumber: 1,
        weightKg: 50,
        reps: 10,
        rpe: 8,
      },
    ],
  },
];

/**
 * Idempotent workout fixtures.
 *
 * Sessions upsert on their pinned `id`; sets upsert on the schema's
 * `@@unique([sessionId, exerciseKey, setNumber])`. Both branches write every
 * column, so a re-run repairs hand-edited fixtures instead of duplicating them.
 *
 * `createdAt` is pinned to `startedAt + n minutes` (4 minutes per set) rather
 * than left to `@default(now())`: the read model uses creation order to decide
 * each exercise group's "first typed" display name, and a batch of inserts in
 * the same millisecond would make that order arbitrary.
 */
async function seedWorkoutSessions(
  userId: string,
  today: string,
): Promise<{ sessions: number; sets: number }> {
  const FOUR_MINUTES_MS = 4 * 60 * 1000;
  let setsSeeded = 0;

  for (const fixture of WORKOUT_SESSION_FIXTURES) {
    // In-progress fixtures are anchored to a real instant ("3 hours ago") so the
    // session is genuinely open; completed ones are anchored to a local hour of
    // day so the seeded history reads like a real training log.
    const startedAt =
      fixture.startedHoursAgo !== undefined
        ? new Date(Date.now() - fixture.startedHoursAgo * 60 * 60 * 1000)
        : atLocalInstant(
            addDays(today, -(fixture.startedDaysAgo ?? 0)),
            fixture.startedHour ?? 18,
          );

    const completedAt =
      fixture.durationMinutes === undefined
        ? null
        : new Date(startedAt.getTime() + fixture.durationMinutes * 60 * 1000);

    const session = await prisma.workoutSession.upsert({
      where: { id: fixture.id },
      create: {
        id: fixture.id,
        userId,
        name: fixture.name,
        notes: fixture.notes,
        startedAt,
        completedAt,
      },
      update: {
        name: fixture.name,
        notes: fixture.notes,
        startedAt,
        completedAt,
      },
    });

    for (const [index, set] of fixture.sets.entries()) {
      const columns = {
        exerciseName: set.exerciseName,
        exerciseKey: set.exerciseKey,
        weightKg: set.weightKg,
        reps: set.reps,
        rpe: set.rpe,
        createdAt: new Date(startedAt.getTime() + index * FOUR_MINUTES_MS),
      };

      await prisma.workoutSet.upsert({
        where: {
          sessionId_exerciseKey_setNumber: {
            sessionId: session.id,
            exerciseKey: set.exerciseKey,
            setNumber: set.setNumber,
          },
        },
        create: {
          sessionId: session.id,
          setNumber: set.setNumber,
          ...columns,
        },
        update: columns,
      });

      setsSeeded += 1;
    }
  }

  return { sessions: WORKOUT_SESSION_FIXTURES.length, sets: setsSeeded };
}

/**
 * Slice 0 seeds exactly one row: the dev user that `getCurrentUser()` resolves.
 * Each feature slice adds its own fixtures when its UI needs them.
 */
async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: {
      id: DEV_USER_ID,
      email: "dev@fitness-os.local",
      name: "Dev Athlete",
      // A non-UTC default so timezone bugs surface in development.
      timezone: "Asia/Kolkata",
      goalWeightKg: 75,
    },
    update: {},
  });

  console.log(`Seeded dev user: ${user.id} (${user.email}, ${user.timezone})`);

  // Slice 1 — 30 days of daily metrics, anchored to today in a fixed timezone.
  const today = todayIso(SEED_TIMEZONE);
  const lastIndex = DAILY_METRIC_FIXTURES.length - 1;
  let metricsSeeded = 0;

  for (const [index, fixture] of DAILY_METRIC_FIXTURES.entries()) {
    const date = addDays(today, index - lastIndex);
    const columns = {
      weightKg: fixture.weightKg,
      calories: fixture.calories,
      proteinG: fixture.proteinG,
      notes: fixture.notes,
    };

    await prisma.dailyMetric.upsert({
      where: { userId_date: { userId: user.id, date: parseIsoDate(date) } },
      create: { userId: user.id, date: parseIsoDate(date), ...columns },
      update: columns,
    });

    metricsSeeded += 1;
  }

  const oldest = addDays(today, -lastIndex);
  console.log(
    `Seeded ${metricsSeeded} daily metric rows for ${user.id} (${oldest} → ${today})`,
  );

  // Slice 2 — habits. Upserted on `userId_name` (the schema's unique key) with a
  // pinned id, so this stays idempotent: re-running never duplicates a habit and
  // never duplicates a log row.
  let logsSeeded = 0;

  for (const fixture of HABIT_FIXTURES) {
    const createdAt = atLocalInstant(
      addDays(today, -fixture.createdDaysAgo),
      fixture.createdHour ?? 12,
    );
    const archivedAt =
      fixture.archivedDaysAgo === undefined
        ? null
        : atLocalInstant(addDays(today, -fixture.archivedDaysAgo), 12);

    const habit = await prisma.habit.upsert({
      where: { userId_name: { userId: user.id, name: fixture.name } },
      create: {
        id: fixture.id,
        userId: user.id,
        name: fixture.name,
        description: fixture.description,
        sortOrder: fixture.sortOrder,
        // Set explicitly: `@default(now())` would make every habit 1 day old,
        // collapsing the capped-denominator branch into a flat denominator of 1.
        createdAt,
        archivedAt,
      },
      update: {
        description: fixture.description,
        sortOrder: fixture.sortOrder,
        createdAt,
        archivedAt,
      },
    });

    // Per-habit logs, anchored to today.
    let logs: HabitLogFixture[] = [];

    switch (fixture.id) {
      case "hab_seed_protein":
        // 12 consecutive days including today.
        logs = consecutiveDays(today, 12).map((date) => ({ date, completed: true }));
        break;

      case "hab_seed_sleep":
        // 11 consecutive days ending yesterday; today is deliberately unlogged
        // so the grace rule is the only thing keeping the streak alive.
        logs = consecutiveDays(addDays(today, -1), 11).map((date) => ({
          date,
          completed: true,
        }));
        break;

      case "hab_seed_read":
        // 3 of the last 7 days ticked, plus 2 explicit unticks. A `false` row is
        // what the real untick action writes, and it must not count toward the
        // rate or the streak.
        logs = [
          { date: addDays(today, -6), completed: true },
          { date: addDays(today, -5), completed: false },
          { date: addDays(today, -4), completed: true },
          { date: addDays(today, -3), completed: false },
          { date: addDays(today, -2), completed: true },
        ];
        break;

      case "hab_seed_steps":
        // Every day this habit has existed: the capped denominator must read
        // 100% rather than 2/7 = 29%.
        logs = consecutiveDays(today, 2).map((date) => ({ date, completed: true }));
        break;

      case "hab_seed_meditate":
        // History on both sides of the archive date (5 days ago).
        logs = [
          ...consecutiveDays(addDays(today, -6), 5).map((date) => ({
            date,
            completed: true,
          })),
          { date: addDays(today, -3), completed: true },
          { date: addDays(today, -1), completed: true },
        ];
        break;

      case "hab_seed_stretch":
        // Today + yesterday, then nothing for a fortnight: the streak must stop
        // at 2 instead of counting the gap.
        logs = consecutiveDays(today, 2).map((date) => ({ date, completed: true }));
        break;
    }

    logsSeeded += await seedHabitLogs(habit.id, logs);
  }

  const [habitCount, logCount] = await Promise.all([
    prisma.habit.count({ where: { userId: user.id } }),
    prisma.habitLog.count(),
  ]);

  console.log(
    `Seeded ${HABIT_FIXTURES.length} habits and ${logsSeeded} log rows for ${user.id} ` +
      `(${habitCount} habits / ${logCount} log rows total)`,
  );

  // Slice 3 — workout history. The in-progress session is deliberately the
  // newest one: `getWorkoutSession` must ignore it when it looks for a
  // "previous top set" target.
  const workout = await seedWorkoutSessions(user.id, today);

  const [sessionCount, setCount] = await Promise.all([
    prisma.workoutSession.count({ where: { userId: user.id } }),
    prisma.workoutSet.count(),
  ]);

  console.log(
    `Seeded ${workout.sessions} workout sessions and ${workout.sets} set rows for ${user.id} ` +
      `(${sessionCount} sessions / ${setCount} set rows total; ` +
      `ws_seed_push_active left in progress)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
