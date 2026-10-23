import Link from "next/link";

import type { RoutineSummary } from "@/lib/routines";
import { cn } from "@/lib/utils";

import { formatRoutineCount, formatWeekdays } from "./format";

/**
 * Column tracks shared by the header and every routine row, so the days and the
 * exercise count land on the same rule from row to row. The identity column
 * keeps the remaining width.
 */
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_88px_64px] sm:grid-cols-[minmax(0,1fr)_200px_96px] lg:grid-cols-[minmax(0,1fr)_280px_120px]";

type RoutinesTableProps = {
  routines: RoutineSummary[];
  className?: string;
};

/** A real em dash, never a stand-in zero. */
function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Every live routine as a ruled ledger.
 *
 * One row per routine, the whole row linking to its detail page: a thumb between
 * sets should not have to aim at a chevron. Days are set in mono because they
 * are the plan's data, and the exercise count is right-aligned where a number
 * column belongs. Unscheduled templates keep a grey em dash rather than an empty
 * cell that reads like a rendering bug.
 */
export function RoutinesTable({ routines, className }: RoutinesTableProps) {
  return (
    <section aria-labelledby="routines-table-heading" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="routines-table-heading" className="text-base font-medium">
          All routines
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {routines.length === 0 ? "None" : formatRoutineCount(routines.length)}
        </p>
      </div>

      <div className="mt-4 flex flex-col">
        <div
          className={cn(
            "border-rule text-muted-foreground grid items-center gap-x-4 border-b pb-2 text-xs sm:gap-x-6",
            COLUMNS,
          )}
        >
          <span>Routine</span>
          <span>Days</span>
          <span className="text-right">Exercises</span>
        </div>

        {routines.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">No routines yet.</p>
        ) : (
          <ul className="divide-rule divide-y">
            {routines.map((routine) => {
              const days = formatWeekdays(routine.weekdays);

              return (
                <li key={routine.id}>
                  <Link
                    href={`/routines/${routine.id}`}
                    className={cn(
                      "hover:bg-card focus-visible:ring-ring/50 grid min-h-[52px] items-center gap-x-4 py-2.5 transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:outline-none sm:gap-x-6",
                      COLUMNS,
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {routine.name}
                    </span>

                    <span className="text-[13px] leading-snug font-mono tabular-nums">
                      {days === null ? (
                        <Missing label="No days set" />
                      ) : (
                        days
                      )}
                    </span>

                    <span className="text-right font-mono text-sm tabular-nums">
                      {routine.exerciseCount}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
