import Link from "next/link";

import { cn } from "@/lib/utils";
import type { WorkoutSessionSummary } from "@/lib/workouts";

import { formatHistoryDate, sessionDay } from "./format";

type SessionListProps = {
  /** Newest first, as returned by `getWorkoutSessionList`. */
  sessions: WorkoutSessionSummary[];
  /** The user's IANA zone; every timestamp below is formatted with it. */
  timezone: string;
  /** The user's calendar day, for "Today" / "Yesterday". */
  today: string;
};

/**
 * The history ledger.
 *
 * A real table, not a stack of cards: the date, the session, the exercises and
 * the set count line up on every row, and the figures are right-aligned in mono
 * so the eye can run down the column. Each row is one full-width link — the row
 * is the tap target, not just the title.
 *
 * The exercises column is hidden on phones and carried as the session's subline
 * instead, which keeps the three remaining columns from squeezing the name.
 */
export function SessionList({ sessions, timezone, today }: SessionListProps) {
  return (
    <section aria-labelledby="workout-history-heading" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="workout-history-heading" className="text-base font-medium">
          History
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-rule text-muted-foreground border-b text-xs">
                <th
                  scope="col"
                  className="w-[104px] py-2 pr-4 text-left font-normal sm:w-[120px]"
                >
                  Date
                </th>
                <th scope="col" className="py-2 pr-4 text-left font-normal">
                  Session
                </th>
                <th
                  scope="col"
                  className="hidden w-[34%] py-2 pr-4 pl-4 text-left font-normal md:table-cell"
                >
                  Exercises
                </th>
                <th
                  scope="col"
                  className="w-[56px] py-2 pl-4 text-right font-normal"
                >
                  Sets
                </th>
              </tr>
            </thead>

            <tbody className="divide-rule divide-y">
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted-foreground py-4 text-sm"
                  >
                    No sessions yet. Log your first workout and every set lands
                    here.
                  </td>
                </tr>
              ) : null}

              {sessions.map((session) => {
                const dateIso =
                  session.scheduledForIso ??
                  sessionDay(session.startedAtIso, timezone);
                const { label, isIso } = formatHistoryDate(dateIso, today);
                const exerciseList = session.exerciseNames.join(" · ");

                return (
                  <tr
                    key={session.id}
                    className="relative h-12 transition-colors hover:bg-card"
                  >
                    <td className="pr-4 align-middle">
                      <time
                        dateTime={dateIso}
                        className={cn(
                          "whitespace-nowrap",
                          isIso && "font-mono tabular-nums",
                        )}
                      >
                        {label}
                      </time>
                    </td>

                    <td className="min-w-0 pr-4 align-middle">
                      <Link
                        href={`/workouts/${session.id}`}
                        className="focus-visible:ring-ring/50 flex min-w-0 flex-col justify-center rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        <span className="absolute inset-0" aria-hidden />
                        <span className="truncate font-medium">
                          {session.name}
                        </span>
                        <span className="text-muted-foreground mt-0.5 truncate text-[13px] md:hidden">
                          {exerciseList === ""
                            ? "No exercises logged"
                            : exerciseList}
                        </span>
                      </Link>
                    </td>

                    <td className="hidden min-w-0 pr-4 pl-4 align-middle md:table-cell">
                      {exerciseList === "" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className="text-muted-foreground block truncate text-[13px]"
                          title={exerciseList}
                        >
                          {exerciseList}
                        </span>
                      )}
                    </td>

                    <td className="text-muted-foreground pl-4 text-right font-mono align-middle tabular-nums">
                      {session.setCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
    </section>
  );
}
