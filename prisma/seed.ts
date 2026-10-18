import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEV_USER_ID } from "../src/lib/dev-user";

// Seed runs outside Next.js (via tsx), so it builds its own client instead of
// importing src/lib/db.ts — that module resolves "@/..." aliases tsx can't see.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

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
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
