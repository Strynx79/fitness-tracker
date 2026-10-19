import Link from "next/link";
import { Dumbbell } from "lucide-react";

import { EmptyState } from "@/app/_components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { addDays, isoDateInZone, todayIso } from "@/lib/date";
import { getLastCompletedWorkout } from "@/lib/workouts";
import { formatShortDate } from "@/lib/workout-format";

/**
 * Volume is a float (`weightKg * reps` summed), but the card is a headline:
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

export async function LastWorkout() {
  const user = await getCurrentUser();
  const workout = await getLastCompletedWorkout(user.id);

  if (workout === null) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="No workouts yet"
        description="Log a session and the last one you finished will stay on this screen."
        action={{ href: "/workouts", label: "Start a workout" }}
      />
    );
  }

  return (
    <section
      aria-labelledby="last-workout-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="last-workout-heading"
          className="text-base font-semibold tracking-tight"
        >
          Last workout
        </h2>

        <Link
          href="/workouts"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
        >
          All workouts
        </Link>
      </div>

      <Link
        href={`/workouts/${workout.id}`}
        className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="transition-colors hover:bg-muted/40">
          <CardHeader>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <CardTitle className="text-lg">{workout.name}</CardTitle>
              <time
                dateTime={workout.completedAtIso}
                className="text-muted-foreground text-sm"
              >
                {describeWhen(workout.completedAtIso, user.timezone)}
              </time>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <dl className="grid grid-cols-3 gap-2">
              <div className="bg-muted/60 rounded-lg px-3 py-2">
                <dt className="text-muted-foreground text-[0.7rem]">Duration</dt>
                <dd className="font-semibold tabular-nums">
                  {workout.durationMinutes} min
                </dd>
              </div>
              <div className="bg-muted/60 rounded-lg px-3 py-2">
                <dt className="text-muted-foreground text-[0.7rem]">Sets</dt>
                <dd className="font-semibold tabular-nums">
                  {workout.setCount} sets
                </dd>
              </div>
              <div className="bg-muted/60 rounded-lg px-3 py-2">
                <dt className="text-muted-foreground text-[0.7rem]">Volume</dt>
                <dd className="font-semibold tabular-nums">
                  {VOLUME.format(Math.round(workout.totalVolumeKg))} kg
                </dd>
              </div>
            </dl>

            <ul className="flex flex-wrap gap-1.5">
              {workout.exerciseNames.map((name, index) => (
                <li key={`${name}-${index}`} className="max-w-full">
                  <Badge variant="secondary" className="max-w-[16rem]">
                    <span className="min-w-0 truncate">{name}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Link>
    </section>
  );
}
