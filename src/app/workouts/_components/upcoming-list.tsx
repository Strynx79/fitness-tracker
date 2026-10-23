import Link from "next/link";

import { formatCalendarDate } from "@/lib/workout-format";
import type { UpcomingWorkoutSummary } from "@/lib/workouts";

type UpcomingListProps = {
  /** Soonest first, as returned by `getUpcomingWorkouts`. */
  workouts: UpcomingWorkoutSummary[];
};

/**
 * Workouts planned for a future date.
 *
 * Renders nothing when there are none: an empty "Upcoming" block would be
 * permanent furniture for anyone who never schedules ahead. The date leads
 * because it is the only thing that distinguishes these rows from history, and
 * there are no chips or status badges — a planned session is already implicit
 * from the block's name.
 */
export function UpcomingList({ workouts }: UpcomingListProps) {
  if (workouts.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-heading" className="flex flex-col">
      <h2 id="upcoming-heading" className="text-base font-medium">
        Upcoming
      </h2>

      <ul className="border-rule divide-rule mt-3 divide-y border-t">
        {workouts.map((workout) => (
          <li key={workout.id}>
            <Link
              href={`/workouts/${workout.id}`}
              className="focus-visible:ring-ring/50 flex min-h-12 items-center gap-4 py-2 transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <time
                dateTime={workout.scheduledForIso}
                className="text-muted-foreground w-[96px] shrink-0 font-mono text-[13px] tabular-nums"
              >
                {formatCalendarDate(workout.scheduledForIso)}
              </time>

              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {workout.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
