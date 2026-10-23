import Link from "next/link";

import type { RoutineSummary } from "@/lib/routines";
import { WEEKDAYS } from "@/lib/weekdays";
import { cn } from "@/lib/utils";

type WeekStripProps = {
  routines: RoutineSummary[];
  /** Today in the user's calendar: 0 = Sunday … 6 = Saturday. */
  todayWeekday: number;
  className?: string;
};

/**
 * The routines on each day, as one block.
 *
 * Desktop keeps the seven-column week — the screen's signature — with the
 * current day marked by a 2px data edge rather than a pill. Below `md` the same
 * seven days become a ruled vertical list, because seven columns in 360px is
 * seven truncated names.
 */
export function WeekStrip({
  routines,
  todayWeekday,
  className,
}: WeekStripProps) {
  const scheduledRoutineCount = routines.filter(
    (routine) => routine.weekdays.length > 0,
  ).length;

  return (
    <section
      aria-labelledby="week-strip-heading"
      className={cn("bg-card rounded-lg p-5 sm:p-6", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-strip-heading" className="text-base font-medium">
          This week
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {scheduledRoutineCount === 0
            ? "None"
            : `${scheduledRoutineCount} scheduled`}
        </p>
      </div>

      <div className="mt-4 hidden gap-x-5 md:grid md:grid-cols-7">
            {WEEKDAYS.map((day) => {
              const isToday = day.index === todayWeekday;
              const entries = routinesForDay(routines, day.index);

              return (
                <div key={day.index} className="min-w-0">
                  <span
                    aria-hidden
                    className={cn(
                      "block h-0.5 rounded-full",
                      isToday ? "bg-data" : "bg-transparent",
                    )}
                  />
                  <p
                    className={cn(
                      "mt-3 text-xs",
                      isToday ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {day.short}
                  </p>
                  <DayEntries routines={entries} className="mt-3" />
                </div>
              );
            })}
          </div>

          <ul className="divide-rule mt-4 divide-y md:hidden">
            {WEEKDAYS.map((day) => {
              const isToday = day.index === todayWeekday;

              return (
                <li key={day.index} className="py-3">
                  <div className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "h-4 w-0.5 rounded-full",
                          isToday ? "bg-data" : "bg-transparent",
                        )}
                      />
                      <p
                        className={cn(
                          "text-xs",
                          isToday
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {day.short}
                      </p>
                    </div>

                    <DayEntries
                      routines={routinesForDay(routines, day.index)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
    </section>
  );
}

function routinesForDay(
  routines: RoutineSummary[],
  weekday: number,
): RoutineSummary[] {
  return routines.filter((routine) => routine.weekdays.includes(weekday));
}

function DayEntries({
  routines,
  className,
}: {
  routines: RoutineSummary[];
  className?: string;
}) {
  if (routines.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-[13px]", className)}>
        <span aria-hidden>—</span>
        <span className="sr-only">Nothing scheduled</span>
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {routines.map((routine) => (
        <li key={routine.id} className="min-w-0">
          <Link
            href={`/routines/${routine.id}`}
            className="group focus-visible:ring-ring/50 block rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="block truncate text-[13px] leading-snug font-medium underline-offset-4 group-hover:underline">
              {routine.name}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
              <span className="font-mono tabular-nums">
                {routine.exerciseCount}
              </span>{" "}
              {routine.exerciseCount === 1 ? "exercise" : "exercises"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
