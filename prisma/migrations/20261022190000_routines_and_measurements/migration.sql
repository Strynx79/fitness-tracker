-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "notes" TEXT,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_exercises" (
    "id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "exercise_id" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "target_sets" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_types" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "measurement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_entries" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(6,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "measurement_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routines_user_id_position_idx" ON "routines"("user_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "routines_user_id_name_key" ON "routines"("user_id", "name");

-- CreateIndex
CREATE INDEX "routine_exercises_routine_id_position_idx" ON "routine_exercises"("routine_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "routine_exercises_routine_id_name_key_key" ON "routine_exercises"("routine_id", "name_key");

-- CreateIndex
CREATE INDEX "measurement_types_user_id_archived_at_idx" ON "measurement_types"("user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_types_user_id_name_key" ON "measurement_types"("user_id", "name");

-- CreateIndex
CREATE INDEX "measurement_entries_type_id_date_idx" ON "measurement_entries"("type_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_entries_type_id_date_key" ON "measurement_entries"("type_id", "date");

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_types" ADD CONSTRAINT "measurement_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_entries" ADD CONSTRAINT "measurement_entries_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "measurement_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
