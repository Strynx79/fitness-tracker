import Link from "next/link";

import { ExercisePickerButton } from "@/components/exercise-picker";
import type { RoutineExerciseDto } from "@/lib/routines";
import { cn } from "@/lib/utils";

import { RoutineExerciseRow } from "./routine-exercise-row";

/**
 * Shared tracks: the exercise name takes the remaining width, the target sets
 * sit in a narrow numeric column, and the remove action keeps one fixed trailing
 * position so it never drifts row to row.
 */
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_56px_88px] sm:grid-cols-[minmax(0,1fr)_96px_96px]";

type RoutineExerciseLedgerProps = {
  routineId: string;
  exercises: RoutineExerciseDto[];
  className?: string;
};

/** A real em dash, never a stand-in zero. */
function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The plan's exercises, in training order.
 *
 * A ruled ledger on the ground rather than a card per exercise: the row is the
 * unit, the whole name is the link to the catalog, and the only per-row action
 * is the quiet "Remove" in the trailing column.
 */
export function RoutineExerciseLedger({
  routineId,
  exercises,
  className,
}: RoutineExerciseLedgerProps) {
  return (
    <section aria-labelledby="routine-exercises-heading" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="routine-exercises-heading" className="text-base font-medium">
          Exercises
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {exercises.length === 0
            ? "None"
            : `${exercises.length} exercise${exercises.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="mt-4 flex flex-col">
        <div
          className={cn(
            "border-rule text-muted-foreground grid items-center gap-x-4 border-b pb-2 text-xs sm:gap-x-6",
            COLUMNS,
          )}
        >
          <span>Exercise</span>
          <span className="text-right">Sets</span>
          <span className="sr-only">Actions</span>
        </div>

        {exercises.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">No exercises yet.</p>
        ) : (
          <ul className="divide-rule divide-y">
            {exercises.map((exercise) => (
              <li
                key={exercise.id}
                className={cn(
                  "grid min-h-[52px] items-center gap-x-4 sm:gap-x-6",
                  COLUMNS,
                )}
              >
                <div className="min-w-0">
                  {exercise.datasetId === null ? (
                    <span className="block truncate text-sm font-medium">
                      {exercise.name}
                    </span>
                  ) : (
                    <Link
                      href={`/exercises/${exercise.datasetId}`}
                      className="focus-visible:ring-ring/50 flex min-h-[52px] items-center rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span className="truncate">{exercise.name}</span>
                    </Link>
                  )}
                </div>

                <div className="text-right">
                  {exercise.targetSets === null ? (
                    <Missing label="No target sets" />
                  ) : (
                    <span className="font-mono text-sm tabular-nums">
                      {exercise.targetSets}
                    </span>
                  )}
                </div>

                <div className="flex justify-end">
                  <RoutineExerciseRow
                    id={exercise.id}
                    name={exercise.name}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <ExercisePickerButton
          target={{ kind: "routine", routineId }}
          className="bg-card h-10 rounded-md px-4 text-sm"
        />
      </div>
    </section>
  );
}
