import Link from "next/link";
import { CalendarCheck, ChevronRight } from "lucide-react";

import { StartRoutineButton } from "@/app/routines/_components/start-routine-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoutineSummary } from "@/lib/routines";
import { WEEKDAYS } from "@/lib/weekdays";

type TodayPlanProps = {
  /** Routines whose schedule includes today's weekday. */
  routines: RoutineSummary[];
  /** 0 = Sunday … 6 = Saturday, in the user's timezone. */
  weekday: number;
};

/**
 * "Today's plan" — the routines scheduled for today.
 *
 * Starting one is the primary action; doing something else is still one tap
 * away via the normal "start a workout" form below. When nothing is scheduled
 * this renders a link to set routines up instead of an empty card.
 */
export function TodayPlan({ routines, weekday }: TodayPlanProps) {
  const dayLabel = WEEKDAYS.find((day) => day.index === weekday)?.label ?? "today";

  if (routines.length === 0) {
    return (
      <Link
        href="/routines"
        className="hover:bg-muted/50 focus-visible:ring-ring/50 flex min-h-14 items-center justify-between gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Nothing planned for {dayLabel}</span>
          <span className="text-muted-foreground text-xs">
            Set up routines to get a Push / Pull / Legs schedule.
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
      </Link>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck aria-hidden className="size-4" />
          Today · {dayLabel}
        </CardTitle>
        <CardDescription>
          Start the plan, or ignore it and log something else below.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {routines.map((routine) => (
          <div
            key={routine.id}
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <Link
              href={`/routines/${routine.id}`}
              className="hover:text-primary min-w-0 flex-1 truncate text-base font-medium underline-offset-4 hover:underline"
            >
              {routine.name}
            </Link>
            <StartRoutineButton routineId={routine.id} className="shrink-0" />
          </div>
        ))}

        <Link
          href="/routines"
          className="text-muted-foreground hover:text-foreground mt-1 text-xs underline-offset-4 hover:underline"
        >
          Edit routines
        </Link>
      </CardContent>
    </Card>
  );
}
