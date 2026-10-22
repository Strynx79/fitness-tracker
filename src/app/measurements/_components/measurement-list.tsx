import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCalendarDate } from "@/lib/workout-format";
import type { MeasurementTypeSummary } from "@/lib/measurements";

type MeasurementListProps = {
  types: MeasurementTypeSummary[];
};

/** "+1.2" / "−0.4", or nothing when there is no second reading to compare to. */
function formatDelta(change: number | null): string | null {
  if (change === null) return null;
  if (change === 0) return "no change";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)}`;
}

/**
 * The measurement list.
 *
 * Each row shows the latest reading, when it was taken, and the change since the
 * one before it — the trend, without needing to open the chart.
 */
export function MeasurementList({ types }: MeasurementListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measurements</CardTitle>
        <CardDescription>
          {types.length === 0
            ? "Nothing tracked yet."
            : "Latest reading and the change since the previous one."}
        </CardDescription>
      </CardHeader>

      {types.length === 0 ? (
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No measurements yet</p>
            <p className="text-muted-foreground max-w-[30ch] text-xs">
              Add one above — waist is a good place to start.
            </p>
          </div>
        </CardContent>
      ) : (
        <ul className="divide-y border-t">
          {types.map((type) => {
            const delta = formatDelta(type.changeFromPrevious);

            return (
              <li key={type.id}>
                <Link
                  href={`/measurements/${type.id}`}
                  className="hover:bg-muted/50 focus-visible:bg-muted/50 flex min-h-16 items-center gap-2 px-4 py-3.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-medium">{type.name}</span>
                      {type.latestValue === null ? null : (
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {type.latestValue} {type.unit}
                        </span>
                      )}
                      {delta === null ? null : (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {delta} {type.unit}
                        </span>
                      )}
                    </span>

                    <span className="text-muted-foreground text-xs">
                      {type.latestDateIso === null
                        ? "No readings yet"
                        : `Last read ${formatCalendarDate(type.latestDateIso)}`}
                      {" · "}
                      <span className="tabular-nums">
                        {type.entryCount}{" "}
                        {type.entryCount === 1 ? "reading" : "readings"}
                      </span>
                    </span>
                  </span>

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
