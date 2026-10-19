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
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
