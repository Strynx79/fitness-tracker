import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/workout-format";

type TodayPlanProps = {
  /** The session under way, or one planned for today; `null` when there is neither. */
  session: TodaySession | null;
  /** True when the session is already being logged, false when it is still planned. */
  isInProgress: boolean;
  className?: string;
};

/** The few fields the panel needs; both an in-progress read and a list row fit. */
export type TodaySession = {
  id: string;
  name: string;
  exerciseNames: string[];
  scheduledForIso: string | null;
};

/**
 * The screen's first answer: what is on the bar today.
 *
 * One panel, never a grid of cards. When a session is under way it leads with
 * "Continue" because resuming beats starting; a session merely planned for
 * today opens instead. With neither, the block keeps its heading and offers the
 * one route that fills it.
 */
export function TodayPlan({ session, isInProgress, className }: TodayPlanProps) {
  return (
    <section
      aria-labelledby="today-plan-heading"
      className={cn("bg-card rounded-lg p-5 sm:p-6", className)}
    >
      <h2 id="today-plan-heading" className="text-base leading-snug font-medium">
        Today&apos;s plan
      </h2>

      {session === null ? (
        <div className="mt-3 flex flex-col items-start gap-1.5">
          <p className="text-muted-foreground text-sm">
            Nothing scheduled for today.
          </p>
          <Link
            href="/routines"
            className="focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Plan the week
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium">{session.name}</p>

            <p className="text-muted-foreground mt-0.5 text-xs">
              {isInProgress
                ? "In progress"
                : session.scheduledForIso === null
                  ? "Planned"
                  : formatCalendarDate(session.scheduledForIso)}
            </p>

            <p className="text-muted-foreground mt-2 truncate text-sm">
              {session.exerciseNames.length === 0
                ? "No exercises added yet."
                : session.exerciseNames.join(" · ")}
            </p>
          </div>

          <Link
            href={`/workouts/${session.id}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -my-2 inline-flex h-11 shrink-0 items-center rounded-md px-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {isInProgress ? "Continue" : "Open"}
          </Link>
        </div>
      )}
    </section>
  );
}
