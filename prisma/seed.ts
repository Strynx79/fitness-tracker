import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEV_USER_ID } from "../src/lib/dev-user";
import { seedExerciseCatalog } from "./exercise-catalog";

// Seed runs outside Next.js (via tsx), so it builds its own client instead of
// importing src/lib/db.ts — that module resolves "@/..." aliases tsx can't see.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    // Seeding can run against a remote Postgres (Neon) from a laptop, where a
    // cold compute start takes a couple of seconds and idle sockets get reaped.
    // Without keepalive and generous timeouts a long import dies mid-run with a
    // bare ETIMEDOUT on whichever model happened to be next.
    keepAlive: true,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
    max: 5,
  }),
});

/**
 * Seeds exactly what a fresh install cannot work without:
 *
 *   1. the single dev user that `getCurrentUser()` resolves
 *   2. the global exercise catalog
 *
 * Training history, daily metrics and habits are deliberately NOT seeded. They
 * used to be (30 days of demo data), which meant every install looked like
 * somebody else's account and had to be wiped before real use. Nothing here
 * deletes anything, so this is safe to re-run against a database you care about.
 */
async function main(): Promise<void> {
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
    select: { id: true, email: true, timezone: true },
  });

  console.log(`Seeded dev user: ${user.id} (${user.email}, ${user.timezone})`);

  // The catalog is global and shared by every user, so it is seeded after (and
  // independently of) the per-user row. Re-running is a no-op except for rows
  // that drifted.
  const catalog = await seedExerciseCatalog(prisma);

  console.log(
    `Seeded exercise catalog: ${catalog.inserted} inserted, ${catalog.updated} updated ` +
      `(${catalog.total} catalog rows total)`,
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
