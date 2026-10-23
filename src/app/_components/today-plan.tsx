import Link from "next/link";

import { DashboardPanel } from "@/app/_components/dashboard-panel";
import { EmptyState } from "@/app/_components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { todayIso, weekdayInZone } from "@/lib/date";
import { getRoutinesForWeekday } from "@/lib/routines";
import { WEEKDAYS } from "@/lib/weekdays";
import { getInProgressSession } from "@/lib/workouts";

const HEADING_ID = "today-plan-heading";

/**
 * The screen's anchor: what is actually on the bar today.
 *
 * Three mutually exclusive states, in priority order:
 *   1. a session already under way — resuming it beats starting a plan;
 *   2. the routines scheduled for today's weekday, with the total exercise
 *      count as the block's one figure;
 *   3. nothing scheduled — say which day is empty and offer the one route that
 *      fills it.
 *
 * `weekdayInZone` resolves the day in the user's own calendar, not the server's:
 * at 23:30 in Asia/Kolkata the UTC day is still yesterday, and Friday's routine
 * would be shown on Thursday. `getInProgressSession` excludes sessions scheduled
 * for a future date, so a planned Saturday is not "in progress" on Friday.
 */
export async function TodayPlan() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);
  const weekday = weekdayInZone(new Date(), user.timezone);

  const [inProgress, routines] = await Promise.all([
    getInProgressSession(user.id, today),
    getRoutinesForWeekday(user.id, weekday),
  ]);

  if (inProgress !== null) {
    return (
      <DashboardPanel
        title="Today's plan"
        headingId={HEADING_ID}
        action={{ href: `/workouts/${inProgress.id}`, label: "Continue" }}
      >
        <div className="flex min-h-14 flex-col justify-center">
          <p className="text-base font-medium">{inProgress.name}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">In progress</p>
        </div>
      </DashboardPanel>
    );
  }

  if (routines.length === 0) {
    const dayLabel =
      WEEKDAYS.find((day) => day.index === weekday)?.label ?? "today";

    return (
      <DashboardPanel title="Today's plan" headingId={HEADING_ID}>
        <EmptyState
          description={`Nothing is planned for ${dayLabel}.`}
          action={{ href: "/routines", label: "Set up a split" }}
        />
      </DashboardPanel>
    );
  }

  // The block's answer figure: every exercise across every routine due today.
  // A routine can exist with zero exercises, so 0 is a real value, not a
  // missing one.
  const totalExercises = routines.reduce(
    (total, routine) => total + routine.exerciseCount,
    0,
  );

  return (
    <DashboardPanel
      title="Today's plan"
      headingId={HEADING_ID}
      action={{ href: "/routines", label: "Plan" }}
    >
      <div className="flex items-baseline gap-1.5">
        <p className="font-mono text-2xl leading-none font-medium tabular-nums">
          {totalExercises}
        </p>
        <span className="text-muted-foreground text-xs">
          {totalExercises === 1 ? "exercise" : "exercises"}
        </span>
      </div>

      <ul className="border-rule divide-rule mt-4 divide-y border-t">
        {routines.map((routine) => (
          <li key={routine.id}>
            <Link
              href={`/routines/${routine.id}`}
              className="group focus-visible:ring-ring/50 flex min-h-14 items-center justify-between gap-3 rounded-sm py-2.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="min-w-0 truncate text-base font-medium underline-offset-4 group-hover:underline">
                {routine.name}
              </span>

              <span className="text-muted-foreground shrink-0 text-[13px]">
                <span className="font-mono tabular-nums">
                  {routine.exerciseCount}
                </span>{" "}
                {routine.exerciseCount === 1 ? "exercise" : "exercises"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}
