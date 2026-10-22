import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedExerciseCatalog } from "./exercise-catalog";

/**
 * Catalog-only import.
 *
 * `npm run db:seed` also writes the per-user fixtures and is destructive to dev
 * data. This entry point exists so the global catalog (1,324 rows, no user data)
 * can be refreshed on its own — the only thing that needs re-running after a
 * fresh migration or a re-vendored dataset.
 *
 * Builds its own client for the same reason `seed.ts` does: tsx cannot resolve
 * the `@/…` alias that `src/lib/db.ts` uses.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    keepAlive: true,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
    max: 5,
  }),
});

async function main(): Promise<void> {
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
