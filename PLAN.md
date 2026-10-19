# PLAN.md — Fitness & Self-Improvement OS

## Slice 0: Project Bootstrapping

Implementation plan for bootstrapping the project ahead of the PRD's feature slices
(Slice 1 Daily Metrics → Slice 2 Habit Engine → Slice 3 Workout Logger → Slice 4 Dashboard).

**Scope of this slice:** Node/Next.js scaffold, local Postgres via Docker Compose, Prisma schema
for the six MVP tables. **No product features.** Per `AGENTS.md`, vertical slices only — Slice 1
cannot begin until this loop is closed and `npm run typecheck` passes with 0 errors.

---

## 0. Environment

Native WSL2 Ubuntu. All tooling must run 100% inside `/home/adwaith/...` as native Linux binaries:
no `/mnt/` access, no Windows executables, no Windows host volume mounts.

| Item | Status |
| --- | --- |
| Node | ✅ v24.22.0 LTS "Krypton" via nvm v0.40.8 (npm 11.19.1) |
| Docker | ✅ Docker Desktop v29.7.2, Compose v5.4.0, WSL 2 integration, `docker` group active |
| Postgres | ✅ `postgres:18-alpine` (18.6) healthy on `localhost:5432`, data on named volume `fitness-os_fitness_pgdata` |

### Verification gate for this slice

```bash
npx prisma validate
npx prisma migrate dev --name init
npm run typecheck     # must report 0 errors
npm run build
```

### Prerequisite install (completed ✅)

```bash
# Node 24 LTS via nvm (v0.40.8 is current)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 24        # resolves to v24.22.0 "Krypton" LTS
nvm alias default 24
node -v && npm -v
```

> Node 26.12.0 is the current **non-LTS** line — do not use it. Node 24 LTS satisfies
> Prisma 7's `Node >= 20.19` requirement.

Docker group activation — from Windows PowerShell:

```powershell
wsl --shutdown
```

Then reopen the terminal and confirm `docker ps` works. Group membership changes only apply to
new WSL sessions, and closing a terminal does not end the session.

---

## 1. Toolchain pins

Three traps identified while researching current versions:

1. **`prisma@latest` is an RC mis-tag** — it resolves to `8.0.0-rc.23` while
   `@prisma/client@latest` is `7.10.1`. Installing "latest" produces a mismatched major pair.
   Pin both to `7.10.1`.
2. **Prisma 7 is ESM-only and has breaking changes:** `prisma-client-js` is deprecated in favour of
   `prisma-client`; the generator's `output` field is now **required**; a **driver adapter is
   mandatory** (`@prisma/adapter-pg`); env vars are **no longer auto-loaded**; `datasource.url`
   moves to `prisma.config.ts`; and `migrate dev` no longer runs `generate` or the seed script.
3. **`typescript@latest` is now `7.0.2`** (the native compiler). Prisma 7 recommends TS 5.9.x,
   and Next 16's tooling is not validated against TS 7 here — pin `5.9.3`.

| Package | Pin | Note |
| --- | --- | --- |
| `next` | `16.4.2` | App Router; requires Node ≥ 20.9 |
| `react` / `react-dom` | `19.3.1` | |
| `tailwindcss` | `4.3.3` | v4, CSS-first config (no `tailwind.config.js`) |
| `shadcn` (CLI) | `4.22.0` | |
| `typescript` | `5.9.3` | **avoid `7.0.2`** |
| `prisma` + `@prisma/client` | `7.10.1` | **avoid the `latest` RC tag** |
| `@prisma/adapter-pg` | `7.10.1` | required by Prisma 7 |
| `pg` / `@types/pg` | `8.23.1` | driver behind the adapter |
| `zod` | `4.6.7` | |
| `recharts` | `3.10.1` | Slice 1+ |
| `lucide-react` | `1.59.0` | |
| Postgres image | `postgres:18-alpine` | 18.6 is newest stable; 19 is still RC |

---

## 2. Execution steps

### Step 1 — Prerequisites

Install Node 24 LTS via nvm; run `wsl --shutdown` from Windows; confirm `node -v` and `docker ps`.

### Step 2 — Scaffold Next.js 16 into a temp dir, then merge

`create-next-app` refuses to run in a non-empty directory, and its allow-list only covers `.git`,
`LICENSE`, `README.md`, `.gitignore`, etc. `AGENTS.md`, `PRD.md`, `opencode.json`, and `.opencode/`
would all be reported as conflicting files. So scaffold elsewhere and move the contents in.

```bash
npx create-next-app@latest /tmp/opencode/fitness-scaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes
# then move contents into the repo, preserving PRD.md / AGENTS.md / .opencode
```

### Step 3 — Pin versions and add scripts

Overwrite the scaffold's floating ranges with the pins in section 1.

```jsonc
"scripts": {
  "typecheck": "tsc --noEmit",        // the AGENTS.md gate
  "db:up":     "docker compose up -d",
  "db:down":   "docker compose down",
  "db:reset":  "prisma migrate reset",
  "postinstall": "prisma generate"    // Prisma 7 removed auto-generate on install
}
```

Add `"engines": { "node": ">=20.19.0" }`.

### Step 4 — shadcn/ui init

```bash
npx shadcn@latest init -b base -p nova --css-variables -y
npx shadcn@latest add button card input label table badge dialog sonner chart
```

Note: there is no `form` component in the current registry — `base-nova` uses `field`
(and `react-hook-form` is added per-slice when Slice 1 needs it).

Commit `src/components/ui/*` so later slices produce clean diffs.

### Step 5 — `docker-compose.yml` + env files

- `postgres:18-alpine`
- **Named volume** mounted on `/var/lib/postgresql` — never a Windows bind mount.
  Postgres 18 moved `PGDATA` to `/var/lib/postgresql/18/docker`, so mounting the
  pre-18 convention (`.../data`) leaves the real data directory on an anonymous
  volume, silently lost when the container is recreated.
- `pg_isready` healthcheck
- Port `5432:5432`
- **No obsolete `version:` key** (Compose v2)

`.env` (gitignored) and `.env.example` (committed):

```
DATABASE_URL="postgresql://fitness:fitness@localhost:5432/fitness_os?schema=public"
```

Add `.env*` and `src/generated/` to `.gitignore`.

### Step 6 — Prisma 7 wiring

Four files:

- `prisma.config.ts` — schema path, migrations path, seed command, `datasource.url` via `env()`,
  with `import "dotenv/config"` at the top (v7 no longer auto-loads env vars).
- `prisma/schema.prisma` — see section 3.
- `src/lib/db.ts` — a `globalThis` singleton. Without it, Next dev HMR exhausts the connection pool:

  ```ts
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });
  ```

- `src/lib/date.ts` — the single module that knows the date-only rule
  (`YYYY-MM-DD` ⇄ `Date` at UTC midnight). Highest-risk area; one chokepoint, not scattered
  `toLocaleDateString()` calls.

### Step 7 — Migrate and verify

```bash
docker compose up -d
npx prisma format && npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
npm run typecheck
```

### Step 8 — Minimal app shell only

Root layout, a placeholder home page, and a `getCurrentUser()` stub in `src/lib/auth.ts` returning
the seeded dev user. **No features** — `AGENTS.md` forbids building ahead of the current slice.

### Step 9 — QA gate

Hand the `git diff` to `@qa-reviewer`: run `npm run typecheck` (0 errors), `npm run build`,
`prisma validate`, and confirm the client singleton, `.gitignore` coverage, and no `any`.

### Files produced

```
docker-compose.yml            postgres:18-alpine, named volume, healthcheck
.env / .env.example           DATABASE_URL
.gitignore                    + .env*, src/generated/
package.json                  pinned deps, typecheck/db:up/db:down/postinstall
tsconfig.json, next.config.ts, eslint.config.mjs, components.json
                              (no postcss/tailwind config — Next 16 wires Tailwind v4
                               through @tailwindcss/turbopack)
prisma.config.ts              schema + migrations + seed paths, datasource.url, dotenv
prisma/schema.prisma          6 models (section 3)
prisma/seed.ts                dev user only, idempotent upsert
src/lib/db.ts                 PrismaClient + PrismaPg adapter, globalThis singleton
src/lib/date.ts               the single YYYY-MM-DD ⇄ Date chokepoint
src/lib/auth.ts               getCurrentUser() stub → DEV_USER_ID
src/app/layout.tsx, src/app/page.tsx    placeholder shell, no features
src/components/ui/*           shadcn primitives
```

---

## 3. Proposed schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"            // NOT prisma-client-js (deprecated in v7)
  output   = "../src/generated/prisma"  // `output` is REQUIRED in Prisma 7
}

datasource db {
  provider = "postgresql"
  // Connection string lives in prisma.config.ts (v7 canonical).
}

// ---------------------------------------------------------------------------
// Users — minimal, auth-less. Shaped like Auth.js's AdapterUser
// (id/email/name/image) so adding auth later is purely additive.
// ---------------------------------------------------------------------------
model User {
  id           String   @id @default(cuid())
  email        String?  @unique
  name         String?
  image        String?
  timezone     String   @default("UTC") @db.VarChar(64)   // IANA, e.g. "Asia/Kolkata"
  goalWeightKg Decimal? @map("goal_weight_kg") @db.Decimal(5, 2)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  dailyMetrics    DailyMetric[]
  habits          Habit[]
  workoutSessions WorkoutSession[]

  @@map("users")
}

// ---------------------------------------------------------------------------
// Slice 1 — Daily metrics & macros
// All measurement columns nullable: NULL means "unknown", so averages/sums
// ignore it rather than being dragged toward 0.
// ---------------------------------------------------------------------------
model DailyMetric {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  date      DateTime @db.Date
  weightKg  Decimal? @map("weight_kg") @db.Decimal(5, 2)
  calories  Int?
  proteinG  Int?     @map("protein_g")
  notes     String?  @db.Text
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  // One row per user per day AND the 30-day trend index. Requires userId
  // NOT NULL — Postgres treats NULLs as distinct, so a nullable userId
  // would let duplicate "anonymous" rows for the same day through.
  @@unique([userId, date])
  @@map("daily_metrics")
}

// ---------------------------------------------------------------------------
// Slice 2 — Habit engine
// Habit = the definition (created once, archived not deleted)
// HabitLog = the per-day completion fact
// ---------------------------------------------------------------------------
model Habit {
  id          String    @id @default(cuid())
  userId      String    @map("user_id")
  name        String    @db.VarChar(120)
  description String?   @db.Text
  sortOrder   Int       @default(0) @map("sort_order")
  archivedAt  DateTime? @map("archived_at") @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  user User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs HabitLog[]

  @@unique([userId, name])
  @@index([userId, archivedAt])   // "my active checklist"
  @@map("habits")
}

model HabitLog {
  id        String   @id @default(cuid())
  habitId   String   @map("habit_id")
  date      DateTime @db.Date
  completed Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  habit Habit @relation(fields: [habitId], references: [id], onDelete: Cascade)

  // Makes check/uncheck a single idempotent upsert (upsert key: habitId_date)
  @@unique([habitId, date])
  @@map("habit_logs")
}

// ---------------------------------------------------------------------------
// Slice 3 — Workout & progressive overload
// ---------------------------------------------------------------------------
model WorkoutSession {
  id          String    @id @default(cuid())
  userId      String    @map("user_id")
  name        String    @db.VarChar(80)          // "Push" | "Pull" | "Legs" | free text
  notes       String?   @db.Text
  startedAt   DateTime  @default(now()) @map("started_at") @db.Timestamptz(3)
  completedAt DateTime? @map("completed_at") @db.Timestamptz(3)  // NULL = in progress
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  sets WorkoutSet[]

  @@index([userId, startedAt])    // history list
  @@index([userId, completedAt])  // Slice 4 "last completed workout"
  @@map("workout_sessions")
}

model WorkoutSet {
  id           String   @id @default(cuid())
  sessionId    String   @map("session_id")
  exerciseName String   @map("exercise_name") @db.VarChar(120)  // display, as typed
  exerciseKey  String   @map("exercise_key")  @db.VarChar(120)  // canonical lookup key
  setNumber    Int      @map("set_number")                       // 1-based, per exercise
  weightKg     Decimal  @default(0) @map("weight_kg") @db.Decimal(5, 2)
  reps         Int
  rpe          Decimal? @db.Decimal(3, 1)                        // 1.0–10.0 in 0.5 steps
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  session WorkoutSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Idempotent "log a set" + covers session-detail reads
  @@unique([sessionId, exerciseKey, setNumber])
  @@index([exerciseKey])   // progressive-overload history per exercise
  @@map("workout_sets")
}
```

---

## 4. Design decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Primary keys | `cuid()` | Opaque in URLs; works in nested `create`/`upsert` with no DB round-trip; lets the seed pin `id: "usr_local_dev"` — the seam that lets Slices 1–4 work before auth exists. |
| `DailyMetric` uniqueness | `@@unique([userId, date])` | Upsert key `userId_date` enforces one row per day and doubles as the 30-day trend index. |
| Date storage | `DateTime @db.Date`, **not** `String` | A true calendar date. ISO strings sort correctly but cannot do SQL date arithmetic, lose `_min`/`_max`, and happily store `2026-02-30`. |
| Timezone | `User.timezone` + client sends `YYYY-MM-DD` | A `@db.Date` read back is `2026-10-18T00:00:00.000Z` — `.getDate()` returns *the previous day* in any UTC-negative region. Write `new Date(\`${iso}T00:00:00.000Z\`)`, read `.toISOString().slice(0,10)`, never `toLocaleDateString()`. One module: `src/lib/date.ts`. |
| Numbers | `Decimal` for `weightKg`/`rpe`, `Int` for `calories`/`proteinG`/`reps` | `Float` cannot represent `0.1`; 30-day averages wobble and chart tooltips show garbage. |
| ⚠️ Decimal → UI | Convert **once** in a mapper | Prisma returns `Prisma.Decimal`, not a JS number. It is not RSC-serializable — passing one to a Client Component **throws at runtime** — and `JSON.stringify` turns it into a string, so Recharts plots nothing. Rule: `toDto(row) → weightKg: row.weightKg?.toNumber() ?? null`. |
| Streaks / 7-day rate | **Computed on read**, no stored columns | A stored counter goes stale on every toggle, backfill, and archive *and* at every midnight rollover. Two indexed queries serve the whole dashboard; ~2k rows/year makes this free. |
| Habit vs HabitLog | Definition row + per-day fact row | `@@unique([habitId, date])` + `upsert` makes toggling one idempotent statement, immune to double-clicks. `completed: false` rows are kept so "explicitly skipped" ≠ "never opened the app". |
| `Exercise` table | **Not yet** — `exerciseName` + `exerciseKey` | A real table drags in a library CRUD, seed data, and autocomplete — none of which are in the PRD. But free text *alone* is a bug generator: `"Bench Press"` / `"bench press"` become different exercises and Slice 3's "previous top set" card silently returns **nothing**. `exerciseKey` (trimmed, lowercased) removes that class of bug for ~zero cost. |
| `weightKg` NOT NULL default 0 | | Postgres sorts `NULL`s **first** in `ORDER BY DESC`, so a nullable weight would make the "top set" a null row for pull-ups. `0` also correctly means bodyweight. |
| `completedAt` | `DateTime?` — no separate `status` enum | `NULL` = in progress. Two fields that can disagree is a bug surface. Slice 4 queries `completedAt: { not: null }` ordered descending. |

---

## 5. Deferred (out of scope for Slice 0)

- `isWarmup` on `WorkoutSet` — a heavy warmup single would be misread as the top set; add in
  Slice 3 if the UX logs warmups.
- `ABANDONED` session status and a "resume or discard" prompt.
- Case-insensitive habit names (needs `citext`, which Prisma cannot declare in-schema).
- Auth (Auth.js) — purely additive later; `email`/`name`/`image` already match `AdapterUser`.
- Set drag-to-reorder (would require shifting `setNumber` inside a transaction).
- Rich seed fixtures — each feature slice seeds its own data when its UI needs it.

---

## 6. Open risks

1. ~~**Prisma 7 ESM.**~~ **Resolved:** `npm run build` succeeds without setting
   `"type": "module"` — Next 16 bundles the ESM-only generated client correctly.
2. ~~**Timezone** becomes load-bearing in Slice 1.~~ **Resolved in Slice 1:** dates are
   `YYYY-MM-DD` end to end, and "today" is derived from `User.timezone` via `todayIso()`, never
   from the server clock. See §8.
3. **No auth = no ownership enforcement.** Any deployed URL exposes every row.
   `getCurrentUser()` must remain the single chokepoint so Slices 1–4 never inline the seed id.

---

## 7. As-built notes (Slice 0 execution record)

Verified on 2026-10-18. Commands below are what actually ran.

### Environment

| Check | Result |
| --- | --- |
| Node | v24.22.0 (nvm 0.40.8), npm 11.19.1 |
| Docker | 29.7.2, Compose v5.4.0, Docker Desktop + WSL 2 integration |
| Postgres | 18.6, container `fitness-os-postgres`, healthy, named volume |
| TypeScript | 5.9.3 (deliberately not 7.0.2) |
| Prisma | 7.10.1 client + CLI + adapter (deliberately not the `8.0.0-rc.23` `latest` tag) |

### Gate results

| Gate | Result |
| --- | --- |
| `npx prisma validate` | ✅ schema is valid |
| `npx prisma migrate dev --name init` | ✅ `20261018173650_init` applied, 6 tables |
| `npx prisma db seed` | ✅ dev user `usr_local_dev` |
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run build` | ✅ 4 static pages |
| `npm run dev` smoke test | ✅ HTTP 200, page renders shadcn components |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

### Deviations from the plan as written

1. **`postcss.config.mjs` does not exist.** Next 16 integrates Tailwind v4 via
   `@tailwindcss/turbopack` configured in `next.config.ts`, with no PostCSS config and no
   `tailwind.config.*` (Tailwind v4 is CSS-first, driven by `@theme` in `globals.css`).
2. **`typecheck` runs typegen first.** Next 16 generates global types such as `LayoutProps<"/">`
   into `.next/types`. A bare `tsc --noEmit` on a clean checkout fails with
   `Cannot find name 'LayoutProps'`. The script is therefore
   `next typegen && tsc --noEmit`.
3. **`datasource` has no `url` field.** Prisma 7 makes `prisma.config.ts` canonical; the schema
   declares only the provider and `prisma validate` passes.
4. **`npm 11` blocks install scripts by default.** Prisma's engine postinstall did not run
   until approving them. `package.json` now pins approvals in `allowScripts` for
   `prisma@7.10.1`, `@prisma/engines@7.10.1`, `esbuild@0.28.2`, `unrs-resolver@1.12.2`.
   A fresh `npm ci` on a new machine needs these in place or `prisma generate` fails.
5. **`shadcn` moved to `devDependencies`.** The CLI adds itself to `dependencies`; it is a
   build-time tool (pulls `ts-morph`, `fast-glob`) and nothing imports it at runtime.
   Leaving it in `dependencies` put 7 high-severity advisories in the production audit.
6. **`cn` utility package.** shadcn now writes `src/lib/utils.ts` as `export { cn } from "cn"` —
   the official compiled replacement for `clsx` + `tailwind-merge`, not the old local helper.
7. **Next.js appends a managed block to `AGENTS.md`.** `next dev` upserts
   `<!-- BEGIN:nextjs-agent-rules -->` into the root `AGENTS.md`. It was added deliberately so
   the tree stays clean; the project's own rules are preserved above it.
8. **`create-next-app` was run in `/tmp` and merged.** It refuses to scaffold into a directory
   containing `AGENTS.md`, `PRD.md`, `opencode.json`, or `.opencode/`.

### Known follow-ups (not blockers)

- 9 high-severity advisories remain in devDependencies, all transitive to the `shadcn` CLI.
  They do not ship. Revisit if the shadcn CLI publishes a fix.
- `recharts` resolved to 3.8.0 (the range `^3.8.0` was pinned by shadcn).
- Slice 1 must confirm the timezone rule before writing any date-handling code.

### QA audit follow-ups applied

An independent audit of the Slice 0 diff found two blockers and several real defects. All were
fixed and re-verified.

| # | Finding | Fix |
| --- | --- | --- |
| B1 | `.gitignore`'s `.env*` also ignored `.env.example`, so the documented setup file could never be committed. | Added `!.env.example`. Verified with `git check-ignore`. |
| B2 | `prisma.config.ts` used `env("DATABASE_URL")`, which throws at config-load time. Since `postinstall` runs `prisma generate`, **`npm install` failed on any fresh clone without `.env`.** | Datasource is now conditional (`...(url ? { datasource: { url } } : {})`). Verified: `prisma generate` exits 0 with no `.env`. |
| S1 | `globals.css` had `--font-sans: var(--font-sans)` — a self-referential cycle, so Geist never rendered. | Pointed at `var(--font-geist-sans)`. Verified in build output: `font-family:Geist`. |
| S2 | `isoDateRange` did not validate its inputs; a garbage end date like `"abc"` satisfied `cursor <= endIso` and looped ~2.9M times. | Validates both ends via `isIsoDate` and caps the range at 3660 days. |
| S3 | `db.ts` / `auth.ts` had no `server-only` guard, so a client component could silently import Prisma. | Added `import "server-only"` to both. Verified it throws on client import. |
| S4 | `docker-compose.yml` published Postgres on `0.0.0.0:5432` with throwaway credentials. | Bound to `127.0.0.1:5432`. |
| S5 | `engines.node: ">=20.19.0"` was wrong — `cn@0.5.0` (used by every shadcn component) requires Node >= 22. | Raised to `>=22`; `@types/node` bumped to `^24` to match the runtime. |
| S6 | `db:reset` did not re-seed. Prisma 7 removed automatic seeding after `migrate reset`, so `getCurrentUser()` would throw on an empty database. | Now `prisma migrate reset && prisma db seed`. |
| S7 | `README.md` was untouched `create-next-app` boilerplate (wrong paths, no database setup). | Replaced with real setup, scripts, and conventions. |
| N1 | `addDays` silently accepted fractional days. | Asserts `Number.isInteger`. |

### Deliberately NOT changed (decisions for later slices)

- **`next.config.ts` keeps `cacheComponents: true` and `partialPrefetching: true`** (the Next 16
  `create-next-app` defaults). Consequence to respect in **Slice 1**: any uncached async data
  access (`getCurrentUser()` → Prisma) must sit behind `<Suspense>` or `use cache`, or
  `next build` fails the prerender.
- **`Habit @@unique([userId, name])`** conflicts with the archive-don't-delete design: archiving
  "Read 20m" then re-adding it would raise P2002. Fix in **Slice 2** at the application layer —
  create-or-unarchive by `(userId, name)` rather than a plain `create`. This is better than a
  partial index (which Prisma cannot express declaratively and would try to drop as drift), and it
  keeps history continuous.
- **CHECK constraints** (`reps > 0`, `weight_kg >= 0`, `1 <= rpe <= 10`) are not expressible in
  `schema.prisma`. Deferred; enforce in the Zod schema for the Slice 3 server action.
- **`WorkoutSet.@@index([exerciseKey])` is not user-scoped.** Harmless with one user; if
  multi-user becomes real, denormalize `userId` onto `WorkoutSet` in **Slice 3** rather than
  backfilling later.
- **`weightKg Decimal @default(0)`** is kept. The NULLS-FIRST ordering concern is also solvable
  with `orderBy: { weightKg: { sort: "desc", nulls: "last" } }`, so this is a tie-break, not a
  defect — but Slice 3's Zod schema must require the field so a form bug cannot silently log 0 kg.

---

## 8. Slice 1 — Daily Metrics & Macros (execution record)

Verified on 2026-10-19. No schema change, no migration — the Slice 0 `DailyMetric` model was
sufficient as designed.

### Scope

Log `date`, `weightKg`, `calories`, `proteinG`, `notes`; show a 30-day weight trend chart and a
recent-history table. **No habits or workout code** (one slice at a time).

### Locked decisions

| Decision | Choice |
| --- | --- |
| Date UX | Deep-link `?date=YYYY-MM-DD` with prefill; table rows link to it |
| Weight bounds | `20–400 kg` (rejects `750` for `75.0`); schema allows up to 999.99 |
| Seed | 30-day fixture set with explicit null/zero edge cases |
| Validation | Server Actions + Zod only. **`react-hook-form` deliberately not added** |

### Files

```
src/lib/validations/daily-metric.ts     Zod v4 schema, one preprocess helper for all optionals
src/lib/daily-metrics.ts                server-only read layer + Decimal->number boundary
src/app/metrics/actions.ts              'use server' saveDailyMetric
src/app/metrics/page.tsx                Suspense shell, PageProps<"/metrics">
src/app/metrics/_components/
  metrics-date-nav.tsx                  GET form + router.push; no-JS fallback + <noscript>
  daily-metric-form.tsx                 useActionState, Field/FieldError, hidden date
  weight-trend-chart.tsx                Recharts LineChart via ChartContainer
  metrics-history-table.tsx             shadcn Table, rows deep-link
  metrics-skeleton.tsx                  Suspense fallback (in the static shell)
src/app/page.tsx                        link to /metrics (placeholder stays until Slice 4)
src/app/layout.tsx                      mounted <Toaster />
prisma/seed.ts                          + 30 daily_metrics fixtures
```

shadcn primitives added: `field` (pulled in `separator`), `skeleton`, `textarea`.

### Architecture notes that the next slice must respect

- **`cacheComponents: true` governs everything.** Every Prisma read is inside `<Suspense>`, and
  `searchParams` is awaited *inside* the boundary, never at the top of the page. `npm run build`
  reports `/metrics` as `◐ (Partial Prerender)` — that output is the proof the boundary is correct.
- **No `use cache`.** This data must be fresh immediately after a write; caching it would let a
  user save a weigh-in and not see it.
- **One Decimal boundary.** `weightKg` is converted with `.toNumber()` exactly once, at
  `daily-metrics.ts`. Client components import that module **type-only**, so nothing server-only
  is bundled.
- **`""` must become `null`, never `0`.** A single `z.preprocess` helper handles `""`,
  whitespace-only, `null`, and absent keys for all four optional fields. A real `"0"` survives as
  `0`. Without this, a user who only weighed in would silently record `calories: 0`.
- **Weight is validated as a string before `Number()`**, with at most 2 decimal places. This avoids
  two traps at once: Postgres silently rounding `80.555` to `80.56`, and `.multipleOf(0.01)` being
  unreliable due to floating-point (`80.55 / 0.01 = 8054.999...`).
- **Ownership comes only from `getCurrentUser()`.** No form field can influence `userId`; the
  action is reachable by direct POST and trusts nothing else.
- **Upsert** on the `userId_date` compound key, with a **full overwrite** of the four value
  columns. The form is the source of truth for that day, which is also what makes clearing a field
  possible.
- **A malformed `?date=` cannot 500.** `isIsoDate` guards it and it falls back to today. Arrays
  (`?date=a&date=b`) take the first value.

### Gate results

| Gate | Result |
| --- | --- |
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run build` | ✅ `/metrics` = `◐ Partial Prerender` |
| `npm run db:seed` | ✅ 30 fixture rows, idempotent |
| Dev smoke (`/metrics`, `?date=2026-10-13`, `?date=abc`, `?date=2026-2-30`, `?date=%20`) | ✅ all HTTP 200 |

### End-to-end verification (real Server Action over HTTP, not just types)

Replayed genuine no-JS multipart submissions against the running action — extracting the
`$ACTION_*` hidden fields the SSR form emits. This exercises validation, ownership, and the upsert
together.

| Case | Result |
| --- | --- |
| Save `81.23 / 2000 / 160` | ✅ 200; row updated; **row count unchanged** (upsert, not insert) |
| Empty `calories`/`proteinG`/`notes` | ✅ stored as **`NULL`**, not `0` |
| `weightKg: 500` | ✅ rejected — *"Weight must be 400 kg or less."*; row untouched |
| `weightKg: 80.555` | ✅ rejected — *"Weight can have at most 2 decimal places."*; row untouched |
| `calories: 0` | ✅ stored as **`0`**, distinct from `NULL` |
| `?date=2030-01-01` | ✅ rejected — *"Date can't be in the future. Pick a date on or before 2026-10-19."*; no row created |

The first and fifth rows are the point of the nullable schema: "unknown" and "zero" are provably
different end to end.

### QA audit follow-ups applied

No blockers. The audit traced the `""`→`null` path, the Decimal boundary, the Suspense/PPR
boundary, ownership, the upsert key, and Zod v4's `z.flattenError` as correct, then found four
issues which were fixed and re-verified:

| # | Finding | Fix |
| --- | --- | --- |
| S1 | Raw Zod v4 defaults were rendered to the user (`Too small: expected number to be >0`, `Invalid input: expected int, received number`). | Every check now carries explicit user-facing copy; a hostile-input scan asserts no message contains `expected`, `Invalid input`, `Too small`, or `Too big`. |
| S2 | `weightKg` accepted more precision than `DECIMAL(5,2)`, so Postgres silently rounded and the input kept showing the unrounded value. | Validate the string form for ≤2 decimal places, then transform to number. 3,200-value grid verified; `80.555` rejected, `080.50` accepted. |
| S3 | A successful save was announced twice to assistive tech (sonner toast + inline `role="status"` live region). | Removed the success toast; the inline live region is the single announcement for both success and error — which also keeps it working with JS disabled. |
| S4 | The out-of-range date error was unactionable: it named no limit and the only editable date control is in a different form. | Message now names the limit; the error renders as a prominent callout at the top of the form. |

### Deviations from the plan as written

1. **`MetricsDateNav` takes a second prop, `today`.** Needed to disable the next-day link and
   "jump to today" without computing "now" from the device clock — the exact drift `date.ts`
   exists to prevent.
2. **`key={selectedDate}` on the entry form.** The inputs are uncontrolled, so `defaultValue` only
   applies on mount. Without the key, tapping a history row would navigate but leave the previous
   day's values in the form.
3. **Added a `<noscript>` submit button** to the date nav. Without JS, changing a date input does
   not submit itself, so the spec'd `method="get"` fallback would have been unreachable.
4. **Added prev/next-day links and "Jump to today"** (navigation only, never writes values).
5. **`"1e2"` is now rejected** (`Enter a number.`). It previously coerced to `100` via
   `z.coerce.number()`. Tightening was required to keep the 2-decimal validation provable.
6. **The seed is a rolling 30-day window and does not prune.** When IST rolled past midnight
   mid-session, re-seeding added the new day and left the previous oldest row, so the table holds
   31 rows. The extra row is outside the 30-day query window and invisible to the UI — history
   accumulating is intended behaviour.

### Known items (not blockers)

- **The trend line was not visually confirmed.** Recharts 3 renders no SVG server-side and there
  is no browser binary in this environment. The chart's data is verified in the RSC payload
  (real weights plus `null` gaps), but the rendered line needs one human look via `npm run dev`.
- **`todayIso` relies on `en-CA` producing ISO order.** Correct on full-ICU Node (official
  binaries, Docker images). On a small-ICU build `en-CA` degenerates to `10/19/2026` and every
  date operation would throw. Informational; harden with `formatToParts` if that ever matters.
- **Uncontrolled inputs do not resync their display after a save** (e.g. `080.50` saves as `80.5`
  but still displays `080.50`). Cosmetic.
- **Unused generated surface:** `FieldSet`/`FieldLegend`/`FieldGroup`/`FieldContent`/`FieldTitle`
  /`FieldSeparator` and `separator.tsx` are unused so far. Standard shadcn convention; keep.

### Carried forward to Slice 2

- **`Habit @@unique([userId, name])` vs archive-don't-delete.** Archiving "Read 20m" and then
  re-adding it would raise P2002. Fix at the application layer: create-or-unarchive by
  `(userId, name)` instead of a plain `create`, which also keeps streak history continuous.
  A partial index is the wrong tool — Prisma cannot express it declaratively and would treat it as
  drift.
