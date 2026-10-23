import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { formatRoutineCount } from "@/app/routines/_components/format";
import { NewRoutineForm } from "@/app/routines/_components/new-routine-form";
import { RoutinesTable } from "@/app/routines/_components/routines-table";
import { WeekStrip } from "@/app/routines/_components/week-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { weekdayInZone } from "@/lib/date";
import { getRoutines, type RoutineSummary } from "@/lib/routines";

export const metadata: Metadata = {
  title: "Routines",
};

/**
 * The header's fact about the data, not about the interface.
 *
 * "5 routines, 3 scheduled this week" answers the screen's question in one line:
 * how many plans exist, and how many of them are actually on a day. A routine
 * with two weekdays still counts once.
 */
function describeRoutines(routines: RoutineSummary[]): string {
  if (routines.length === 0) return "No routines yet.";

  const scheduled = routines.filter(
    (routine) => routine.weekdays.length > 0,
  ).length;

  const fact =
    scheduled === 0
      ? "none scheduled this week"
      : `${scheduled} scheduled this week`;

  return `${formatRoutineCount(routines.length)}, ${fact}.`;
}

/**
 * Reusable plans and the week they fill.
 *
 * The header's count, the week strip and the table all come from one read, so
 * the whole screen waits behind one boundary rather than letting a header claim
 * "no routines" while the list is still streaming.
 */
export default function RoutinesPage() {
  return (
    <PageShell width="wide">
      <Suspense fallback={<RoutinesSkeleton />}>
        <RoutinesContent />
      </Suspense>
    </PageShell>
  );
}

async function RoutinesContent() {
  const user = await getCurrentUser();
  const routines = await getRoutines(user.id);
  const todayWeekday = weekdayInZone(new Date(), user.timezone);

  return (
    <>
      <ScreenHeader
        title="Routines"
        description={describeRoutines(routines)}
      />

      <WeekStrip
        routines={routines}
        todayWeekday={todayWeekday}
        // The header-to-first-block rhythm on data screens is 60px; PageShell
        // already supplies 24px of it.
        className="mt-9"
      />

      <RoutinesTable routines={routines} />

      <NewRoutineForm />
    </>
  );
}

function RoutinesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Routines</h1>
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="bg-card mt-9 flex flex-col gap-4 rounded-lg p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-28 w-full rounded-md" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[52px] w-full rounded-none" />
        ))}
      </div>

      <Skeleton className="bg-card h-[264px] w-full rounded-lg" />
    </div>
  );
}
