-- AlterTable
ALTER TABLE "workout_sets" ADD COLUMN     "exercise_id" TEXT;

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "dataset_id" VARCHAR(8) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "body_part" VARCHAR(40) NOT NULL,
    "equipment" VARCHAR(40) NOT NULL,
    "target" VARCHAR(60) NOT NULL,
    "muscle_group" VARCHAR(60),
    "secondary_muscles" TEXT[],
    "instructions_en" TEXT NOT NULL,
    "steps_en" TEXT[],
    "image_path" VARCHAR(200),
    "gif_path" VARCHAR(200),
    "attribution" VARCHAR(120) NOT NULL,
    "youtube_url" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_dataset_id_key" ON "exercises"("dataset_id");

-- CreateIndex
CREATE INDEX "exercises_name_key_idx" ON "exercises"("name_key");

-- CreateIndex
CREATE INDEX "exercises_body_part_idx" ON "exercises"("body_part");

-- CreateIndex
CREATE INDEX "exercises_equipment_idx" ON "exercises"("equipment");

-- CreateIndex
CREATE INDEX "exercises_target_idx" ON "exercises"("target");

-- CreateIndex
CREATE INDEX "workout_sets_exercise_id_idx" ON "workout_sets"("exercise_id");

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
