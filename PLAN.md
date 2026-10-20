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

---

## 9. Slice 2 — Self-Improvement Habit Engine (execution record)

Verified on 2026-10-19. **No migration** — the Slice 0 `Habit`/`HabitLog` model was sufficient.

### Locked decisions

| Decision | Choice |
| --- | --- |
| Checklist scope | **Today only** — streaks and rates are unambiguously anchored to today |
| Management | **Create + archive** (soft delete; `archivedAt`) |
| Toggles | **`useOptimistic`** — instant tick, then the server settles streak/rate |

### Files

```
src/lib/date.ts                        + isoDateInZone(date, tz)  (todayIso now delegates to it)
src/lib/validations/habit.ts           create/toggle/archive schemas
src/lib/habits.ts                      server-only; 2 queries; streak + 7-day-rate math
src/app/habits/actions.ts              createHabit, toggleHabit, archiveHabit
src/app/habits/page.tsx + _components/ checklist, row, form, skeleton
src/components/ui/checkbox.tsx         added
prisma/seed.ts                         + 6 habit fixtures, 39 log rows
```

### The two algorithms — and why they are shaped that way

**Current streak, with the grace rule.** `anchor` = today if completed, else yesterday if completed, else null → 0; then walk backwards. Without the grace rule every streak reads 0 from midnight until today's box is ticked, which is the classic streak-UI bug.

**7-day completion rate, with a capped denominator.** `denominator = min(7, daysAlive)`, where `daysAlive` **counts the creation day**. A habit created yesterday that is completed both days reads **100%**, not 29%. A fixed `/7` punishes new habits and reads as failure.

**`createdAt` must go through `isoDateInZone`, not `toIsoDate`.** `createdAt` is a `timestamptz`; `toIsoDate` formats in UTC, so a habit created at 01:00 IST lands on the previous UTC day, inflating `daysAlive` and showing 50% for a perfect first day. The seed pins this exact case.

Both are computed on read — no denormalized counters, which would go stale on every toggle, archive, *and* at midnight.

### Query plan

Exactly 2 queries: active habits (`@@index([userId, archivedAt])`), then one `findMany` over `habitId: { in: ids }` with a 365-day `date` range. Zero habits skips the second query. Streaks cap at the window; `streakCapped` drives a `365+` label rather than silently under-reporting.

### Gate results and verification

| Check | Result |
| --- | --- |
| `typecheck` / `lint` / `build` | ✅ 0 errors / clean / `/habits` = `◐` Partial Prerender |
| `prisma db seed` ×3 | ✅ 6 habits / 39 logs, no growth |
| Independent stats run | ✅ see table below |
| HTTP `toggleHabit` round-trip | ✅ untick keeps the row with `completed=false`; retick restores |
| Ownership | ✅ ghost `habitId` → `ok:false "Habit not found."` with **0 rows written** |
| Guards | ✅ archived habit and future date both rejected |

| Fixture | streak | rate | Proves |
| --- | --- | --- | --- |
| Hit Protein Goal | 12 | 100% | normal streak |
| **8h Sleep** | **11** | 86% | **grace rule** — non-zero with today unchecked |
| Read 20m | 0 | 43% | sparse; 2 `completed:false` rows persist |
| **10k Steps** | 2 | **100%** | **capped denominator** |
| Stretch | 2 | 29% | streak reset after a gap |
| Meditate 10m | — | — | archived: absent from the checklist, history intact |

### QA follow-up applied

| # | Finding | Fix |
| --- | --- | --- |
| S1 | The create-or-unarchive path restored `archivedAt: null` but **dropped the submitted `description`**. Applying it blindly would be worse — a blank field would *wipe* the stored description. | A non-null description replaces it; a blank one preserves it. Both branches asserted; still exactly one row per `(userId, name)`. |

### Deviations

1. `archiveHabit` uses `updateMany({ where: { id, userId } })` + `count === 0` so ownership is enforced in the same statement as the write.
2. Restoring a habit keeps its original `sortOrder`, so it reappears in its old position.
3. A `P2002` from `create` maps to the same duplicate-name field error, since the lookup-then-create pair is not atomic.
4. The seed is a **rolling 30-day window** for `daily_metrics` and does not prune, so the row count grows by one per day. Invisible to the UI, which queries the current window.

### Known items

- The optimistic flip and the archive confirm dialog are JS-only and **were not executed** — no browser binary available. Review-only.
- `streakCapped` (`365+`) has no seed coverage; the longest seeded streak is 12.
- There is still **no test script**, so the grace rule and the capped denominator are protected only by fixtures.

---

## 10. Slice 3 — Workout & Progressive Overload Logger (execution record)

Verified on 2026-10-19. **No migration** — `WorkoutSession`/`WorkoutSet` were sufficient.

### Locked decisions

| Decision | Choice |
| --- | --- |
| Lifecycle | **In-progress + explicit Finish** — `completedAt` NULL while active, stamped on Finish |
| Top set | **Heaviest `weightKg`**, tie-break most reps, then lowest `setNumber` |
| Correction | **Delete a set** (a mistyped set would otherwise poison every future target) |

### Files

```
src/lib/validations/numbers.ts         shared decimal-string builder (min/decimals/messages)
src/lib/validations/workout.ts         create/logSet/delete/finish/discard schemas
src/lib/workouts.ts                    server-only; session list, detail, suggestions, DTOs
src/app/workouts/actions.ts            createSession, logSet, deleteSet, finishSession, discardSession
src/app/workouts/page.tsx + _components/            list + new-session form
src/app/workouts/[id]/page.tsx + _components/       header, log-set form, exercise groups
src/lib/workout-format.ts              shared explicit-timezone formatters
prisma/seed.ts                         + 6 sessions, 31 sets
```

### Rules that matter

- **`exerciseKey` is derived server-side only** (`trim → collapse whitespace → lowercase`) and is never a form field. `exerciseName` keeps what the user typed. This is what stops `"Bench Press"` and `"bench  press"` fragmenting history and silently emptying the "beat this" callout.
- **`setNumber` is computed** from `_max(setNumber)` scoped to `(sessionId, exerciseKey)`, never client-supplied. `P2002` is handled as a retryable message. Deleting does **not** renumber, so gaps are expected.
- **Previous top set:** only `completedAt IS NOT NULL` sessions, current session excluded, 12-month window on session start, one query for all exercise keys, then a JS reduction. An in-progress session can never become a target.
- **`weightKg` is NOT NULL**, so `0` (bodyweight) ranks as a real top set rather than being lost to Postgres's NULLS-FIRST ordering.
- **Every mutation runs in a transaction whose first statement is a guarded `updateMany` on the session row** (`{ id, userId, completedAt: null }`). The UPDATE takes a row lock held to commit, so concurrent mutations serialize and a finish cannot interleave with a set write.

### Gate results and verification

| Check | Result |
| --- | --- |
| `typecheck` / `lint` / `build` | ✅ 0 errors / clean / `/workouts` and `/workouts/[id]` both `◐` |
| `prisma db seed` ×2 | ✅ 6 sessions / 31 sets, no growth |
| HTTP log-set form replay | ✅ set **#2** auto-assigned, RPE 8.5 persisted, session went 2 → 3 sets |
| Previous top set (Bench Press) | ✅ `90 kg × 5 @ 9.5` from the 5-day-old session — not the 12-day-old 85×6, not the in-progress one |
| Bodyweight top set (pull-ups) | ✅ `weightKg: 0` chosen, not null |
| Per-exercise numbering | ✅ squat 1..5, second exercise restarts at 1 |
| Ownership | ✅ foreign/bogus session id → `null`; `logSet` into a finished session rejected; bogus `deleteSet`/`finishSession` → `{ok:false}` |
| Concurrency invariants (24 runs) | ✅ completed ⇒ ≥1 set; **no set `createdAt` after `completedAt`**; `setNumber` unique per exercise |

### QA follow-ups applied

| # | Finding | Fix |
| --- | --- | --- |
| S1 | `logSet`/`finishSession`/`deleteSet` read-then-wrote without serialization: a concurrent finish could write a set into finished history, or leave a completed session with **zero** sets. | All four mutations now lock the session row inside a `$transaction` and re-check inside it. Proven over 24 concurrent runs. |
| N1 | Previous-top-set grouping keyed on `startedAt` rather than session id — two sessions sharing a timestamp would be merged. | Keys on `session.id`; `startedAt` only picks the newest. |
| N2 | Session summaries deduped by display name, so one session could list both `"Bench Press"` and `"bench press"`. | Dedupes on `exerciseKey`. |
| N3 | A failed **no-JS** submit lost the controlled exercise name while keeping the numeric values. | Seeds the controlled state from `state.values?.exerciseName`. |

### Deviations

1. **Unknown session ids return a soft 404** (HTTP 200 with correct not-found UI and `noindex`). `notFound()` sits inside the Suspense boundary, which `cacheComponents` requires; a hard 404 would mean awaiting the DB check above the boundary and losing PPR for the route. Accepted.
2. Delete is hidden on completed sessions, because the action refuses them.
3. `src/lib/workout-format.ts` was added so server and client components share one explicit-timezone formatter.
4. The log-set form's exercise name is **controlled** so it survives the post-submit reset — you can log set after set without retyping it.
5. `finishSession` additionally carries `sets: { some: {} }` in its `updateMany`, so an empty session cannot be completed even under a concurrent delete.

### Known items

- No browser: the controlled-input persistence, the delete/finish/discard dialogs, and the optimistic interactions **were not executed**.
- `getWorkoutSessionList` is unpaginated.
- Decimal validation now exists in two places (`daily-metric.ts` is committed and was deliberately left untouched). `numbers.ts` is the consolidation target.
- `WorkoutSet` has no `isWarmup` flag, so a heavy warmup single would be picked as the top set. Add in a later slice if warmups are logged.

### Carried into Slice 4

- The dashboard needs "last **completed** workout", which is `where: { userId, completedAt: { not: null } } order by completedAt desc take 1` — served by `@@index([userId, completedAt])`.
- "Latest body weight vs goal" reads the newest `DailyMetric.weightKg` against `User.goalWeightKg`.
- "Today's habit checklist" can reuse `getHabitChecklist` unchanged.
- Watch the `cacheComponents` rule: every one of those three reads needs its own Suspense boundary so the dashboard keeps a static shell.

---

## 11. Slice 4 — Unified Dashboard (execution record)

Verified on 2026-10-19. **No migration, no seed change** — the existing fixtures populate all three cards.

### Locked decisions

| Decision | Choice |
| --- | --- |
| Habit card | **Interactive** — `HabitChecklist` reused verbatim (optimistic toggles work from `/`) |
| Navigation | **Bottom tab bar**, app-wide in `layout.tsx` |
| Weight card | Current, goal, delta, **and** a 7-day change |

### Files

```
src/lib/daily-metrics.ts          + getWeightSummary (latest non-null weigh-in, goal delta, trend)
src/lib/workouts.ts               + getLastCompletedWorkout
src/app/habits/actions.ts         revalidateHabitViews() -> /habits AND /
src/app/page.tsx                  rewritten: static shell + 3 independent boundaries
src/app/_components/              app-nav, weight-card, today-habits, last-workout,
                                  dashboard-skeletons, empty-state
src/app/layout.tsx                mounts <AppNav />, bottom padding, Toaster moved to top-center
src/app/metrics/actions.ts        + revalidatePath("/") in saveDailyMetric
src/app/workouts/actions.ts       + revalidatePath("/") in finishSession
```

### Architecture notes

- **Three independent Suspense boundaries, one per card.** A single boundary would make the page as slow as its slowest query. The prerendered shell contains **33 skeletons and 0 seeded strings** — proof the cards stream rather than block.
- **The shell stays static.** The timezone-dependent date lives in its own boundary; contrast Slice 2, where the date forced the whole body to stream.
- **`latest` skips null weights.** A day with macros but no weigh-in (`weightKg: null`) must not become "latest body weight". This is the payoff of the nullable columns.
- **Every delta is `null`-safe.** `deltaKg`/`change7dKg` are `null` when the weight or goal is missing — never `NaN`, never a fake `0`. Deltas are rounded to 2dp so `79.8 - 75 = 4.800000000000001` cannot leak into the UI.
- **The trend baseline is returned, not assumed.** `baseline` is the weigh-in the 7-day delta was measured against, so the card can say "0.6 kg since Oct 12" instead of falsely claiming "this week".
- **An in-progress session is never "last workout"** (`completedAt: { not: null }`), the same rule that makes the previous-top-set correct.
- **Revalidation is cross-cutting.** The dashboard reads from all three domains, so `saveDailyMetric`, `finishSession`, and the three habit actions all revalidate `/`. Missing this was the slice's most likely silent bug: the optimistic tick reverting, or a stale weight card.
- **Date-only values are formatted in UTC; real instants in the user's timezone.** Formatting a `YYYY-MM-DD` in a user's zone slides it a day for anyone west of UTC.

### Gate results and verification

| Check | Result |
| --- | --- |
| `typecheck` / `lint` / `build` | ✅ 0 errors / clean / `/` = `◐` Partial Prerender |
| Static shell | ✅ 33 skeletons, 0 seeded strings |
| Routes | ✅ `/`, `/metrics`, `/habits`, `/workouts`, `/workouts/[id]` all 200 |
| Nav | ✅ four tabs on every route; `aria-current="page"` correct on `/workouts/[id]` |
| Dashboard content | ✅ `79.8`, `4.8 kg above goal`, `0.6 kg since Oct 12`, `Hit Protein Goal`, `8h Sleep`, `3 of 5 done`, `Push`, `70 min`, `9 sets`, `3,113 kg`, five exercise names |
| `NaN` occurrences | ✅ 0 |
| Headings | ✅ three `<h2>`s (Weight, Today's habits, Last workout) |
| Empty user | ✅ all-null summary, no `NaN`; `getLastCompletedWorkout` → `null` |

### QA follow-ups applied

| # | Finding | Fix |
| --- | --- | --- |
| S1 | `saveDailyMetric` and `finishSession` revalidated only their own routes, so the client router could serve a **stale weight or last-workout card** after a mutation — the same class of bug already fixed for habits. | Both now revalidate `/` too. |
| S2 | Sonner's default bottom-right offset rendered every toast **underneath the fixed tab bar**. | Toaster moved to `position="top-center"`. |
| S3 | The trend label claimed "this week" even when the baseline was months old, and rendered "No change" when there was no baseline at all. | `baseline` added to the DTO; renders "No trend yet" / "No change since <date>" / "0.6 kg since <date>". |
| N1 | "N of M done" rendered twice in the habit card (wrapper + checklist). | Removed the outer count; the checklist owns it. |
| N2 | Whole-card links carried an `aria-label`, which **replaces** the accessible name, hiding the weight/duration/volume from screen readers in links mode. | Removed; accessible name now comes from content. All three cards expose an `<h2>`. |
| N3 | Exercise chips keyed by display name → possible duplicate keys on imported data. | Key includes the index. |
| N4 | `getLastCompletedWorkout` ordered only by `completedAt`, non-deterministic on ties. | Added `startedAt` then `id` tiebreaks. |

### Known MVP gaps

- **`goalWeightKg` has no UI.** It is only set by `prisma/seed.ts`. For any account other than the seeded dev user, the weight card is permanently "No goal set" with no way to fix it. "Latest body weight vs goal" is therefore only half-complete as a product feature. A small goal field on `/metrics` (or a profile form) would close it.
- **No test script.** The grace rule, the capped denominator, top-set ranking, session locking, and the weight deltas are all protected by fixtures and deleted throwaway scripts, not by regression tests. `node --test` needs no dependency.
- **No auth**, and `getWorkoutSessionList` is unpaginated — both carried since Slice 0.
- Reusing `HabitChecklist` verbatim puts an Archive control on the dashboard as well as `/habits`. Accepted.
- No browser binary in this environment: every JS-only interaction (optimistic toggles, dialogs, active-tab transitions) was reviewed but never executed.

### MVP status

Slices 0–4 complete: daily metrics + macros with a 30-day trend, a habit engine with streaks and completion rates, a progressive-overload workout logger, and a unified dashboard. `npm run typecheck` is green and every route builds as Partial Prerender.

---

## 12. Slice 5 — Settings & Backup (execution record)

Verified on 2026-10-20. No migration, no schema change.

### Locked decisions

| Decision | Choice |
| --- | --- |
| Location | Gear icon in the dashboard header → `/settings` (tab bar stays at four) |
| Timezone input | Native `<select>` of IANA names |
| Backup | Shipped in the same slice |

### Files

```
src/lib/validations/profile.ts          isValidTimeZone + profileSchema
src/lib/timezones.ts                    listTimezones(includeValue)
src/app/settings/actions.ts             updateProfile
src/app/settings/page.tsx + _components/ page, form, skeleton
src/app/page.tsx                        gear link
scripts/db-backup.sh                    pg_dump + gzip
package.json / .gitignore / README.md   db:backup, backups/, restore docs
```

### The trap that would have shipped a lie

`Intl.supportedValuesOf("timeZone")` returns **418 canonical names and omits `Asia/Kolkata`** —
the canonical entry is `Asia/Calcutta`. The stored user timezone is the *alias*.

Validating by list membership would have:
- rejected the user's own existing value on save, and
- rendered the select with **no matching option**, silently showing the first zone while the
  database still held `Asia/Kolkata`.

Validation is therefore **by construction** — `new Intl.DateTimeFormat("en-CA", { timeZone }).format()`
in a try/catch — which accepts aliases exactly as `Intl` does everywhere else. `listTimezones()`
re-injects the current value so an alias always renders. The `RangeError` is the real failure mode
being guarded: `todayIso()` runs on every page, so one bad row would take the whole app down.

### Cross-cutting rule

Changing the timezone moves what counts as "today" for every feature, so `updateProfile` revalidates
`/settings`, `/`, `/metrics`, `/habits` and `/workouts`. Same class of bug as the dashboard
revalidation gap fixed in §11.

### Backup

`npm run db:backup` writes a timestamped, `0600`-mode, gzipped `pg_dump` with
`--clean --if-exists` into the gitignored `backups/`.

### QA follow-ups applied

| # | Finding | Fix |
| --- | --- | --- |
| S1 | A same-second run **deleted the previous good backup**: gzip refuses to overwrite, `set -e` fired the cleanup trap, and the trap removed both files. | A `noclobber` reservation makes the loser exit non-zero having touched nothing; the trap only removes files the run created. The earlier backup's checksum was verified unchanged. |
| S2 | The documented restore was wrong: plain-format dumps contain `CREATE TABLE`, so restoring over a populated DB fails — and without `ON_ERROR_STOP` psql **keeps going and exits 0**, leaving a silent half-restore. | `--clean --if-exists` on the dump; `-v ON_ERROR_STOP=1` in the documented command; the README states that restoring replaces data. |
| N1 | Fragile `head \| grep -q` header check (SIGPIPE under `pipefail`). | `grep -q 'PostgreSQL database dump' "$OUT"`. |
| N2 | Dump was created mode `0644` with all personal data in it. | `umask 077` → `600`. |
| N3 | Timezone injection was untrimmed. | Trim, and skip blanks. |
| N4 | Neither control was linked to its hint or error text. | `aria-describedby`, including the error id only when one exists. |
| N5 | Copy claimed the values affect "dashboard, habits and metrics". | Now includes workout times. |

### Verification

| Check | Result |
| --- | --- |
| `typecheck` / `lint` / `build` | ✅ 0 errors / clean / `/settings` = `◐` |
| Backup round-trip | ✅ dump → restore into scratch DB → identical counts (`1/32/6/47/6/31`) |
| Double restore over populated DB | ✅ both applications exit 0 with `ON_ERROR_STOP` |
| Collision test | ✅ loser exits 1; first backup checksum unchanged |
| File mode | ✅ `600` (was `644`) |
| Alias handling | ✅ `Asia/Kolkata` accepted, present **and selected** in the rendered select |
| Invalid timezone | ✅ rejected server-side, DB unchanged |
| Goal clearing | ✅ `null` persisted; `0` rejected by the range |

### Known gaps

- No UI to *restore* a backup — a documented one-liner only.
- Both an alias and its canonical name are accepted (two different strings, one zone). Harmless, but
  two users could store different spellings of the same zone.
- No auth (carried since §7).

---

## 13. Slice 6 — Regression Tests (execution record)

Verified on 2026-10-20. No migration, no UI change, no new dependencies.

### Scope

Unit tests for the rules that make the app correct — and the extraction required to make those rules
testable at all. `npm run verify` (typecheck + lint + tests) is now the project's definition of done.

### The bug the baseline found before any refactor

Capturing the current checklist output *before* touching code immediately surfaced
`10k Steps` reporting **150%**.

Mechanism: `createdAt` is `2026-10-19 01:00 IST` (the deliberate timezone fixture, stored as
`2026-10-18T19:30Z`), so `daysAlive` is 2 and the denominator is 2. But a log row existed on
**Oct 18 — before the habit existed** — and the numerator counted every completion in the 7-day
window regardless. 3 / 2 = 150%.

This is reachable in production, not just a seed artifact: `toggleHabit` accepts any
`date <= today`, including dates before the habit was created. There is no backfill UI yet, but the
action permits it, and any future one would hit this immediately.

**Fix:** intersect the rate window with the habit's lifetime, rather than clamping the result:

```ts
const lifetimeStart = createdLocalDate > rateWindowStart ? createdLocalDate : rateWindowStart;
const completedInWindow = rateWindow.reduce(
  (count, date) => (date >= lifetimeStart && dates.has(date) ? count + 1 : count), 0,
);
```

Clamping at 100 would have hidden the inconsistency and kept the tests unable to tell the
difference — which is exactly the hole the audit later found.

### Extractions (the point of the slice)

The rules worth testing lived inside DB-fetching functions guarded by `import "server-only"`, so a
plain `node --test` could not import them. They are now pure modules with no `server-only`, Prisma or
Next imports:

| Module | Exports | Delegating caller |
| --- | --- | --- |
| `src/lib/habit-stats.ts` | `computeHabitStats`, `STREAK_WINDOW_DAYS`, `RATE_WINDOW_DAYS` | `habits.ts` |
| `src/lib/exercise.ts` | `deriveExerciseKey`, `pickTopSet` | `workouts.ts`, `workouts/actions.ts`, **`prisma/seed.ts`** |
| `src/lib/weight-summary.ts` | `summarizeWeight` | `daily-metrics.ts` |
| `src/lib/weight-series.ts` | `buildWeightSeries`, `WeightPoint` | `daily-metrics.ts` (re-exported, so UI imports are unchanged) |

Bonus: `prisma/seed.ts` now derives every `exerciseKey` from the real function instead of
hand-writing 31 duplicated keys, removing a documented drift risk.

### Tests — 58 across 6 files

| File | Count | Pins |
| --- | --- | --- |
| `tests/date.test.ts` | 9 | invalid calendar dates, DST-safe day arithmetic, range cap, `isoDateInZone` boundary |
| `tests/habit-stats.test.ts` | 20 | grace rule, capped denominator, rounding, the FIX 0 lifetime intersection, 365-day streak cap, `last7Days` shape |
| `tests/exercise.test.ts` | 8 | key canonicalization, top-set ranking, bodyweight `0`, no mutation |
| `tests/weight-summary.test.ts` | 12 | every null combination, sign convention, 2dp rounding |
| `tests/validation.test.ts` | 12 | the **shipped** schemas: blank→null vs real `0`, precision, bounds, timezone aliases |
| `tests/weight-series.test.ts` | 3 | every day present, nulls for gaps, ascending |

Tests import only pure modules: no database, no network, no ambient clock. Verified identical under
`TZ=America/New_York`, `TZ=Asia/Kolkata` and `TZ=UTC`.

### Behavioural equivalence — proven, not assumed

The acceptance criterion for a refactor of working code is identical behaviour, so:

1. Captured a probe of every habit's `streak` / `streakCapped` / `completionRate7d` /
   `checkedToday` / 7-day strip, both top sets, and the whole weight summary.
2. Restored the **HEAD** versions of `habits.ts`, `workouts.ts`, `daily-metrics.ts`, ran the same
   probe against the **same live data**, then restored the refactor and re-ran.
3. The diff contains exactly one line: `10k Steps` `150 → 100` — the intended fix.

The first comparison had a second diff (`Hit Protein Goal` 12→13), which turned out to be a *data*
change: a reseed restored the fixture log that had been unticked during manual testing. Running old
and new code against identical data isolated the logic change from the data change.

### Mutation probes — all executed

Six production mutations, each confirmed to turn the suite red, then restored byte-identically:

| Mutation | Fails |
| --- | --- |
| `Math.min(7, daysAlive)` → `daysAlive` | 1 |
| remove `Math.round` | 1 |
| lifetime filter → post-hoc clamp at 100 | 2 |
| grace anchor → "today only" | 3 |
| `pickTopSet` `setNumber <` → `>` | 1 |
| remove the 365-day streak `break` | 1 |

### QA follow-ups applied

The audit found that the two most important rules were **effectively untested** — a green suite that
would not have caught a real regression:

| # | Finding | Fix |
| --- | --- | --- |
| S1 | Every non-zero rate test used a creation date ≤ 3 days old, where `min(7, daysAlive)` is a no-op. Deleting the cap kept all 48 tests green while every habit older than a week would report `3/31` instead of `3/7`. Rounding was likewise unpinned (0 and 100 are exact). | Added a week-old cap case (expects 100; unclamped gives 88) and a 1-of-3 case (expects 33; unrounded gives 33.33…). |
| S2 | The FIX 0 tests asserted only `100`, so replacing the lifetime filter with a clamp kept them green — the exact anti-pattern the code comment warns against. | Added a discriminator: created yesterday, ticked the pre-creation day and yesterday but not today → **50** correctly, **100** under a clamp. |
| S3 | `validation.test.ts` tested **cloned** schemas, not the shipped ones. Drift had already occurred: it asserted `"Enter weight."`, which the app never emits (real copy is `"Enter the weight. Use 0 for bodyweight."`). | Rewritten against `logSetSchema`, `profileSchema`, `createHabitSchema` and `dailyMetricInputSchema`, asserting exact production messages. |
| N1 | Decorative NaN test (`Number.isNaN(null) === false` passes for `null` or `undefined`). | Replaced with exact per-combination expectations. |
| N2 | Unreachable `assert.ok(rate <= 100)` after `assert.equal(rate, 100)`. | Removed. |
| N3 | Expected dates computed with the production `isoDateRange`/`addDays` (circular). | Hardcoded. |
| N4 | Tautological sort assertion in the weight-series test. | Removed. |
| N5 | `last7Days` marks a pre-creation completion as `true` while the rate excludes it. | Kept as raw logged truth, now commented **and** pinned by a test. |
| N6 | `AGENTS.md` Role Separation still told QA to run only `typecheck`. | Now says `npm run verify`. |

### Tooling

```jsonc
"test":   "node --import tsx --test \"tests/*.test.ts\"",
"verify": "npm run typecheck && npm run lint && npm run test"
```

`node --test` is built in; `tsx` was already a devDependency. No new packages. `tsc` already covers
`tests/` via the `**/*.ts` include, so the tests are typechecked too.

### Known gaps (documented, not accidental)

- **The Slice 3 concurrency invariant is not regression-tested.** "A finished session never gains a
  set" needs a live database and racing transactions; it is covered only by the one-off 24-run proof
  from §10.
- Components, Server Actions and the DB read functions are not unit tested. This slice deliberately
  targets the pure rules, where silent regressions actually live.

### Project status

Six slices, all committed, `npm run verify` green (58 tests). Every route builds as Partial
Prerender. The two correctness bugs outstanding after Slice 4 — unsettable timezone and goal — were
closed in §11; the completion-rate bug was closed here.
