import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { RoutineControls } from "@/app/routines/[id]/_components/routine-controls";
import { RoutineExerciseLedger } from "@/app/routines/[id]/_components/routine-exercise-ledger";
import { RoutineKpis } from "@/app/routines/[id]/_components/routine-kpis";
import { formatWeekdays } from "@/app/routines/_components/format";
import { StartRoutineButton } from "@/app/routines/_components/start-routine-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { addDays, todayIso } from "@/lib/date";
import { getRoutine, type RoutineDetail } from "@/lib/routines";

export const metadata: Metadata = {
  title: "Routine",
};

/**
 * One routine: what it contains, when it runs, and the way to start it.
 *
 * `params` is awaited inside the Suspense boundary together with the query,
 * matching every other detail route under Cache Components.
 */
export default function RoutinePage({ params }: PageProps<"/routines/[id]">) {
  return (
    <PageShell width="wide">
      <Suspense fallback={<RoutineSkeleton />}>
        <RoutineContent params={params} />
      </Suspense>
    </PageShell>
  );
}

/** Weekday words + exercise count: the plan's two facts, nothing else. */
function describeRoutine(routine: RoutineDetail) {
  const days = formatWeekdays(routine.weekdays);
  const count = routine.exercises.length;

  return (
    <>
      {days === null ? (
        "Not scheduled"
      ) : (
        <span className="font-mono tabular-nums">{days}</span>
      )}
      <span> · </span>
      <span className="font-mono tabular-nums">{count}</span>{" "}
      {count === 1 ? "exercise" : "exercises"}
    </>
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

  // Only real targets count. With none set at all, the KPI is an em dash rather
  // than a "0" that would claim the plan asks for no sets.
  const targets = routine.exercises.flatMap((exercise) =>
    exercise.targetSets === null ? [] : [exercise.targetSets],
  );
  const setsPlanned =
    targets.length === 0 ? null : targets.reduce((sum, value) => sum + value, 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink
          href="/routines"
          label="Plan"
          className="-ml-2 h-8 px-2 text-[13px]"
        />

        <ScreenHeader
          title={routine.name}
          description={describeRoutine(routine)}
          action={<StartRoutineButton routineId={routine.id} />}
        />

        {routine.notes === null ? null : (
          <p className="text-muted-foreground max-w-[62ch] text-sm whitespace-pre-line">
            {routine.notes}
          </p>
        )}
      </div>

      <RoutineKpis
        exerciseCount={routine.exercises.length}
        setsPlanned={setsPlanned}
        daysPerWeek={routine.weekdays.length}
        className="mt-9"
      />

      <RoutineExerciseLedger
        routineId={routine.id}
        exercises={routine.exercises}
      />

      <RoutineControls
        routineId={routine.id}
        routineName={routine.name}
        weekdays={routine.weekdays}
        today={today}
        defaultDate={addDays(today, 1)}
      />
    </>
  );
}

function RoutineSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      <Skeleton className="bg-card mt-9 h-[96px] w-full rounded-lg" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[52px] w-full rounded-none" />
        ))}
      </div>

      <Skeleton className="bg-card h-[220px] w-full rounded-lg" />
    </div>
  );
}
