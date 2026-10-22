import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";

import { BackLink } from "@/app/_components/back-link";
import { RoutineControls } from "@/app/routines/[id]/_components/routine-controls";
import { RoutineExerciseRow } from "@/app/routines/[id]/_components/routine-exercise-row";
import { StartRoutineButton } from "@/app/routines/_components/start-routine-button";
import { ExercisePickerButton } from "@/components/exercise-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { addDays, todayIso } from "@/lib/date";
import { getRoutine } from "@/lib/routines";

export const metadata: Metadata = {
  title: "Routine",
};

/**
 * One routine: the plan, its weekly schedule, and the way to start it.
 *
 * `params` is awaited inside the Suspense boundary together with the query,
 * matching every other detail route under Cache Components.
 */
export default function RoutinePage({ params }: PageProps<"/routines/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/routines" label="All routines" />

      <Suspense fallback={<RoutineSkeleton />}>
        <RoutineContent params={params} />
      </Suspense>
    </main>
  );
}

async function RoutineContent({
  params,
}: Pick<PageProps<"/routines/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const routine = await getRoutine(user.id, id);

  // Missing and not-owned are the same answer.
  if (routine === null) notFound();

  const today = todayIso(user.timezone);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{routine.name}</h1>
        {routine.notes === null ? null : (
          <p className="text-muted-foreground text-sm whitespace-pre-line">
            {routine.notes}
          </p>
        )}
      </header>

      <StartRoutineButton routineId={routine.id} size="lg" />

      <Card>
        <CardHeader>
          <CardTitle>Exercises</CardTitle>
          <CardDescription>
            {routine.exercises.length === 0
              ? "Add the exercises this routine is built from."
              : "In the order you want to train them."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {routine.exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-8 text-center">
              <p className="text-sm font-medium">No exercises yet</p>
              <p className="text-muted-foreground max-w-[28ch] text-xs">
                Search the library below, or add a custom exercise.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {routine.exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="flex items-center gap-2 border-b last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    {exercise.datasetId === null ? (
                      <p className="truncate py-2 text-sm font-medium">
                        {exercise.name}
                      </p>
                    ) : (
                      <Link
                        href={`/exercises/${exercise.datasetId}`}
                        className="hover:text-primary inline-flex items-center gap-1 truncate py-2 text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {exercise.name}
                        <ExternalLink
                          aria-hidden
                          className="size-3.5 shrink-0 opacity-60"
                        />
                      </Link>
                    )}
                  </div>

                  <RoutineExerciseRow
                    id={exercise.id}
                    name={exercise.name}
                  />
                </div>
              ))}
            </div>
          )}

          <ExercisePickerButton
            target={{ kind: "routine", routineId: routine.id }}
          />
        </CardContent>
      </Card>

      <RoutineControls
        routineId={routine.id}
        routineName={routine.name}
        weekdays={routine.weekdays}
        today={today}
        defaultDate={addDays(today, 1)}
      />
    </div>
  );
}

function RoutineSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
