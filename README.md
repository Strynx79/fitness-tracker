# Fitness & Self-Improvement OS

Track daily body weight and macros, build self-improvement habits with streaks, and log
progressive-overload workouts.

Next.js 16 (App Router) + TypeScript, Tailwind v4 + shadcn/ui, PostgreSQL 18 (Docker) + Prisma 7,
Zod.

## Requirements

- Node.js **>= 22** (developed on 24.22.0 LTS)
- Docker with Compose (`docker compose`)

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # DATABASE_URL for the local Postgres
npm run db:up               # start Postgres
npx prisma migrate dev      # apply migrations
npm run db:seed             # create the dev user
npm run dev                 # http://localhost:3000
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start / stop local Postgres |
| `npm run db:reset` | Drop, re-migrate, and re-seed |
| `npm run db:seed` | Seed the dev user (idempotent) |

## Architecture

```
src/app/          App Router pages
src/components/ui shadcn/ui primitives
src/lib/db.ts     Prisma client singleton (driver adapter, HMR-safe)
src/lib/date.ts   the ONLY place that converts YYYY-MM-DD <-> Date
src/lib/auth.ts   getCurrentUser() -- the single ownership chokepoint
prisma/schema.prisma   6 MVP models
prisma.config.ts       Prisma 7 CLI config (schema, migrations, seed, datasource)
```

### Conventions that matter

- **Dates.** Postgres `date` columns are calendar dates with no timezone. Always go through
  `src/lib/date.ts`. Never call `toLocaleDateString()` on a value from the database — it returns
  the previous day outside UTC.
- **Decimals.** `weightKg` and `rpe` are `Decimal` in the database but `Prisma.Decimal` (a
  decimal.js object) in JS. Convert to `number` in the server action / mapper layer before passing
  values to React — Prisma's `Decimal` is not serializable to a Client Component and throws at
  runtime.
- **Ownership.** Every table is owned via `userId`. Never inline a user id; call
  `getCurrentUser()`. Auth is not implemented yet — the MVP resolves a single seeded dev user
  (`usr_local_dev`).
- **Slices.** Features are built one vertical slice at a time (Database → Server Action → UI → QA).
  A slice is not done until `npm run typecheck` reports 0 errors.

## Status

Slice 0 (bootstrapping) complete. Feature slices 1–4 are tracked in `PLAN.md` and `PRD.md`.
