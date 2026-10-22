import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoutineSummary } from "@/lib/routines";
import { WEEKDAYS } from "@/lib/weekdays";

import { StartRoutineButton } from "./start-routine-button";

type RoutineListProps = {
  routines: RoutineSummary[];
};

/** "Mon · Wed · Fri", or a hint when the routine has no schedule yet. */
export function formatWeekdays(weekdays: number[]): string {
  if (weekdays.length === 0) return "No days set";

  const byIndex = new Map(WEEKDAYS.map((day) => [day.index, day.short]));
  return [...weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Monday-first ordering
    .map((index) => byIndex.get(index) ?? "?")
    .join(" · ");
}

/**
 * The routine list.
 *
 * Each row links to the editor; Start is a separate control because starting a
 * workout and editing the plan are very different intents and a whole-row link
 * can only do one of them.
 */
export function RoutineList({ routines }: RoutineListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My routines</CardTitle>
        <CardDescription>
          {routines.length === 0
            ? "Nothing here yet."
            : "Start one as-is, or open it to change the exercises."}
        </CardDescription>
      </CardHeader>

      {routines.length === 0 ? (
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No routines yet</p>
            <p className="text-muted-foreground max-w-[30ch] text-xs">
              Create Push, Pull and Legs above, then assign them to days of the
              week.
            </p>
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex flex-col gap-3">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <Link
                href={`/routines/${routine.id}`}
                className="hover:bg-muted/50 focus-visible:ring-ring/50 -m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors focus-visible:ring-3 focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-base leading-snug font-medium">
                    {routine.name}
                  </span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock aria-hidden className="size-3.5" />
                      {formatWeekdays(routine.weekdays)}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {routine.exerciseCount}{" "}
                      {routine.exerciseCount === 1 ? "exercise" : "exercises"}
                    </span>
                  </span>
                </span>

                <ChevronRight
                  aria-hidden
                  className="text-muted-foreground/60 size-4 shrink-0"
                />
              </Link>

              <StartRoutineButton routineId={routine.id} className="shrink-0" />
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
