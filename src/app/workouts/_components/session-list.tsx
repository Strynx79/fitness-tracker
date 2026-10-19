import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkoutSessionSummary } from "@/lib/workouts";
import { formatInstant } from "@/lib/workout-format";

type SessionListProps = {
  /** Newest first, as returned by `getWorkoutSessionList`. */
  sessions: WorkoutSessionSummary[];
  /** The user's IANA zone; every timestamp below is formatted with it. */
  timezone: string;
};

function formatSetCount(count: number): string {
  return `${count} ${count === 1 ? "set" : "sets"}`;
}

/**
 * The session history.
 *
 * Kept as a Server Component: the timestamps are formatted with the explicit
 * `user.timezone` and the client never needs to know or guess a zone. Each row
 * is one full-width link, so the tap target is the card, not the title text.
 */
export function SessionList({ sessions, timezone }: SessionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>
          Newest first. Open a session to log more sets or review it.
        </CardDescription>
      </CardHeader>

      {sessions.length === 0 ? (
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No workouts yet</p>
            <p className="text-muted-foreground max-w-[28ch] text-xs">
              Start one above and log your first set — next time you&apos;ll have
              a target to beat.
            </p>
          </div>
        </CardContent>
      ) : (
        <ul className="divide-y border-t">
          {sessions.map((session) => {
            const isCompleted = session.completedAtIso !== null;

            return (
              <li key={session.id}>
                <Link
                  href={`/workouts/${session.id}`}
                  className="hover:bg-muted/50 focus-visible:bg-muted/50 flex min-h-16 items-center gap-2 px-4 py-3.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base leading-snug font-medium">
                        {session.name}
                      </span>
                      <Badge variant={isCompleted ? "secondary" : "default"}>
                        {isCompleted ? "Completed" : "In progress"}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <time dateTime={session.startedAtIso}>
                        {formatInstant(session.startedAtIso, timezone)}
                      </time>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">
                        {formatSetCount(session.setCount)}
                      </span>
                    </p>

                    {session.exerciseNames.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        No sets logged yet
                      </p>
                    ) : (
                      <p className="text-muted-foreground truncate text-xs">
                        {session.exerciseNames.join(" · ")}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    aria-hidden
                    className="text-muted-foreground/60 size-4 shrink-0"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
