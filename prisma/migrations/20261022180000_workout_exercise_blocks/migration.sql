-- Slice 10 — exercise blocks + scheduled workouts.
--
-- Three changes, in an order that keeps existing training history intact:
--   1. workout_exercises (new) — the card an exercise lives in
--   2. workout_sessions.scheduled_for — a workout can be planned ahead
--   3. workout_sets.workout_exercise_id — every set now belongs to a block
--
-- Step 3 is a two-phase column: added nullable, backfilled from the sets that
-- already exist, then made NOT NULL. A plain "ADD COLUMN NOT NULL" would fail on
-- any non-empty database.

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "exercise_id" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN "scheduled_for" DATE;

-- AlterTable (nullable for now; made NOT NULL after the backfill below)
ALTER TABLE "workout_sets" ADD COLUMN "workout_exercise_id" TEXT;

-- Backfill: one block per (session, exercise_key) that already has sets.
--
-- DISTINCT ON picks the set that was logged first, so the block inherits the
-- display name the user typed back then and the catalog link (if any). Position
-- preserves the order the exercises were first trained in, which is exactly the
-- order the session page used to render.
WITH first_sets AS (
    SELECT DISTINCT ON (ws."session_id", ws."exercise_key")
        ws."session_id",
        ws."exercise_key",
        ws."exercise_name",
        ws."exercise_id",
        ws."created_at"
    FROM "workout_sets" ws
    ORDER BY
        ws."session_id",
        ws."exercise_key",
        ws."created_at" ASC,
        ws."set_number" ASC
),
ordered AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY "session_id"
            ORDER BY "created_at" ASC, "exercise_key" ASC
        ) - 1 AS "position"
    FROM first_sets
)
INSERT INTO "workout_exercises" (
    "id",
    "session_id",
    "exercise_id",
    "name",
    "name_key",
    "position",
    "created_at",
    "updated_at"
)
SELECT
    -- cuid-shaped enough for the column (TEXT); collisions are not a concern at
    -- this scale, and the primary key would reject one loudly if they were.
    'c' || replace(gen_random_uuid()::text, '-', ''),
    o."session_id",
    o."exercise_id",
    o."exercise_name",
    o."exercise_key",
    o."position",
    o."created_at",
    CURRENT_TIMESTAMP
FROM ordered o;

-- Attach every existing set to its block. Matching on name_key is what makes
-- "Bench Press" and "bench press" land in the same block, same as before.
UPDATE "workout_sets" ws
SET "workout_exercise_id" = we."id"
FROM "workout_exercises" we
WHERE we."session_id" = ws."session_id"
  AND we."name_key" = ws."exercise_key";

-- Every set now has a block; a set without one would be invisible in the UI.
ALTER TABLE "workout_sets" ALTER COLUMN "workout_exercise_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "workout_exercises_session_id_name_key_key" ON "workout_exercises"("session_id", "name_key");

-- CreateIndex
CREATE INDEX "workout_exercises_session_id_position_idx" ON "workout_exercises"("session_id", "position");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_scheduled_for_idx" ON "workout_sessions"("user_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "workout_sets_workout_exercise_id_idx" ON "workout_sets"("workout_exercise_id");

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
