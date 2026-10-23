import Link from "next/link";

import { DashboardPanel } from "@/app/_components/dashboard-panel";
import { EmptyState } from "@/app/_components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { addDays, isoDateInZone, todayIso } from "@/lib/date";
import { getLastCompletedWorkout } from "@/lib/workouts";
import { formatShortDate } from "@/lib/workout-format";

/**
 * Volume is a float (`weightKg * reps` summed), but the panel is a headline:
 * round it, then group thousands so "3113" reads as "3,113".
 */
const VOLUME = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/**
 * "Yesterday" when it helps, otherwise the weekday label. Both are resolved
 * from the server's idea of today in the USER's zone — the browser clock is
 * never consulted.
 */
function describeWhen(iso: string, timeZone: string): string {
  const day = isoDateInZone(new Date(iso), timeZone);
  const today = todayIso(timeZone);

  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";

  return formatShortDate(iso, timeZone);
}

/**
 * The last finished session, as a summary rather than a history.
 *
 * The session name is the one link into the detail screen; "All workouts" in
 * the header is the route back to the list. Volume is the block's figure —
 * duration and sets are the supporting columns under the rule.
 */
export async function LastWorkout() {
  const user = await getCurrentUser();
  const workout = await getLastCompletedWorkout(user.id);

  if (workout === null) {
    return (
      <DashboardPanel title="Last workout" headingId="last-workout-heading">
        <EmptyState
          description="No workouts yet."
          action={{ href: "/workouts", label: "Start a workout" }}
        />
      </DashboardPanel>
    );
  }

  const exerciseList = workout.exerciseNames.join(" · ");

  return (
    <DashboardPanel
      title="Last workout"
      headingId="last-workout-heading"
      action={{ href: "/workouts", label: "All workouts" }}
    >
      <Link
        href={`/workouts/${workout.id}`}
        className="focus-visible:ring-ring/50 -mt-2 flex min-h-11 w-fit max-w-full flex-col justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="text-sm font-medium">{workout.name}</span>
        <time
          dateTime={workout.completedAtIso}
          className="text-muted-foreground mt-0.5 font-mono text-[13px] tabular-nums"
        >
          {describeWhen(workout.completedAtIso, user.timezone)}
        </time>
      </Link>

      <div className="mt-3 flex items-baseline gap-1.5">
        <p className="font-mono text-2xl leading-none font-medium tabular-nums">
          {VOLUME.format(Math.round(workout.totalVolumeKg))}
        </p>
        <span className="text-muted-foreground text-xs">kg volume</span>
      </div>

      {exerciseList === "" ? null : (
        <p className="text-muted-foreground mt-2 truncate text-[13px]">
          {exerciseList}
        </p>
      )}

      <div className="border-rule text-muted-foreground mt-3 flex items-baseline justify-between gap-3 border-t pt-3 text-[13px]">
        <span className="font-mono tabular-nums">
          {workout.durationMinutes} min
        </span>
        <span className="font-mono tabular-nums">{workout.setCount} sets</span>
      </div>
    </DashboardPanel>
  );
}
