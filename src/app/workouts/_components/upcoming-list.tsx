import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCalendarDate } from "@/lib/workout-format";
import type { UpcomingWorkoutSummary } from "@/lib/workouts";

type UpcomingListProps = {
  /** Soonest first, as returned by `getUpcomingWorkouts`. */
  workouts: UpcomingWorkoutSummary[];
};

/**
 * Workouts planned for a future date.
 *
 * Renders nothing when there are none — an empty "Upcoming" card would be a
 * permanent piece of furniture for anyone who never schedules. The date is the
 * headline here (it is the only thing that distinguishes these rows from
 * history), so it leads and the workout's own name follows.
 */
export function UpcomingList({ workouts }: UpcomingListProps) {
  if (workouts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays aria-hidden className="size-4" />
          Upcoming
        </CardTitle>
        <CardDescription>
          Planned workouts. Open one to add exercises or start logging.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <ul className="divide-y border-t">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link
                href={`/workouts/${workout.id}`}
                className="hover:bg-muted/50 focus-visible:bg-muted/50 flex min-h-16 items-center gap-2 px-4 py-3.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base leading-snug font-medium">
                      {formatCalendarDate(workout.scheduledForIso)}
                    </span>
                    <Badge variant="outline">{workout.name}</Badge>
                  </div>

                  {workout.exerciseNames.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No exercises planned yet
                    </p>
                  ) : (
                    <p className="text-muted-foreground truncate text-xs">
                      {workout.exerciseNames.join(" · ")}
                    </p>
                  )}
                </div>

                <ChevronRight
                  aria-hidden
                  className="text-muted-foreground/60 size-4 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
