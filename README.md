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
| `npm run db:backup` | Timestamped gzipped `pg_dump` into `backups/` |

## Backup & restore

`npm run db:backup` writes `backups/fitness-os-<YYYYmmdd-HHMMSS>.sql.gz` — a gzipped
plain-SQL `pg_dump` taken inside the Postgres container. The dump is created with
`--clean --if-exists`, so it drops and recreates its own objects and can be restored over
an existing database. `backups/` is gitignored, and dumps are created mode `0600`
(they contain personal data).

> **Warning:** restoring **replaces the existing data**. `--clean` drops the tables in the
> dump before recreating them, so every row currently in the target database's dumped
> tables is destroyed. Stop the app, take a fresh backup first, and use
> `-v ON_ERROR_STOP=1` so psql aborts instead of continuing after an error (without it,
> a failed restore can leave the database half-applied while still exiting 0).

Restore a dump over the running database (same command restores into an empty database):

```bash
gunzip -c backups/<file>.sql.gz | docker exec -i fitness-os-postgres psql -v ON_ERROR_STOP=1 -U fitness -d fitness_os
```

To try a dump without touching the live data, restore into a scratch database first:

```bash
docker exec fitness-os-postgres createdb -U fitness fitness_os_verify
gunzip -c backups/<file>.sql.gz | docker exec -i fitness-os-postgres psql -v ON_ERROR_STOP=1 -U fitness -d fitness_os_verify
docker exec fitness-os-postgres dropdb -U fitness fitness_os_verify
```

> **Warning:** `docker compose down -v` destroys the Postgres data volume and all data in it.
> Use `npm run db:down` to stop the container without deleting the database.

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
