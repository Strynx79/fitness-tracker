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
  //
  // The timeouts and keepalive are for a REMOTE Postgres (Neon): its free tier
  // suspends idle computes, so the first query after a pause takes a couple of
  // seconds, and an idle socket can be reaped between requests. With the pg
  // defaults that surfaces as a bare `ETIMEDOUT` on whichever query came next.
  // Against a local container these values are simply never reached.
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      keepAlive: true,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    }),
  });
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
