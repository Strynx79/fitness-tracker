import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and start Postgres with `npm run db:up`.",
  );
}

function createPrismaClient(): PrismaClient {
  // Prisma 7 requires a driver adapter; it uses the `pg` connection pool.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Next.js re-evaluates modules on every HMR pass in dev. Without caching the
// client on globalThis, each pass opens a new pool and exhausts Postgres
// connections. In production the module is evaluated once, so this is a no-op.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
