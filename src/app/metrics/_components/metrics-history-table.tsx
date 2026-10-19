"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyMetricDto } from "@/lib/daily-metrics";
import { parseIsoDate } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * "Sat, Oct 18" from `YYYY-MM-DD`.
 *
 * Formatted with an explicit UTC timezone against the parsed UTC-midnight
 * instant, so the weekday can never slide a day in a negative-offset locale.
 */
const friendlyDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatFriendlyDate(iso: string): string {
  return friendlyDateFormatter.format(parseIsoDate(iso));
}

/** `null` means "not logged" and must never read as a zero. */
function ValueOrDash({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground" aria-label="Not logged">
        —
      </span>
    );
  }
  return <span className="tabular-nums">{value}</span>;
}

type MetricsHistoryTableProps = {
  /** Newest first, as returned by `getDailyMetricHistory`. */
  rows: DailyMetricDto[];
  selectedDate: string;
};

export function MetricsHistoryTable({ rows, selectedDate }: MetricsHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Tap a date to open and edit that day.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">Nothing logged yet</p>
            <p className="text-muted-foreground max-w-[26ch] text-xs">
              Entries you save will show up here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Weight (kg)</TableHead>
                <TableHead className="text-right">Calories</TableHead>
                <TableHead className="text-right">Protein (g)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isSelected = row.date === selectedDate;

                return (
                  <TableRow
                    key={row.date}
                    data-state={isSelected ? "selected" : undefined}
                    className="h-12"
                  >
                    <TableCell>
                      <Link
                        href={`/metrics?date=${row.date}`}
                        aria-current={isSelected ? "date" : undefined}
                        className={cn(
                          "font-medium underline-offset-4 hover:underline",
                          isSelected && "text-foreground",
                        )}
                      >
                        {formatFriendlyDate(row.date)}
                      </Link>
                      <span className="text-muted-foreground ml-2 hidden text-xs sm:inline">
                        {row.date}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ValueOrDash value={row.weightKg} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValueOrDash value={row.calories} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValueOrDash value={row.proteinG} />
                    </TableCell>
                    <TableCell className="max-w-[10rem]">
                      {row.notes === null ? (
                        <span className="text-muted-foreground" aria-label="No notes">
                          —
                        </span>
                      ) : (
                        <span className="block truncate" title={row.notes}>
                          {row.notes}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
