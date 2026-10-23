import Link from "next/link";

import type { DailyMetricDto } from "@/lib/daily-metrics";
import { parseIsoDate } from "@/lib/date";
import { cn } from "@/lib/utils";

import { formatKg, formatSignedKg, roundTenths } from "./weight-format";

/**
 * "Sat, Oct 18" from `YYYY-MM-DD`.
 *
 * UTC is load-bearing: the value is a date-only string pinned at UTC midnight,
 * and re-reading it in the runtime's zone would print the previous day for
 * every zone behind UTC.
 */
const WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const MS_PER_DAY = 86_400_000;

/**
 * Recent days read in words ("Today", "Yesterday", "Sat, Oct 18"); anything
 * older falls back to the ISO date, which is shorter to scan in a table and
 * unambiguous across months.
 */
function formatDateLabel(
  isoDate: string,
  today: string,
): { label: string; isIso: boolean } {
  const days = Math.round(
    (parseIsoDate(today).getTime() - parseIsoDate(isoDate).getTime()) / MS_PER_DAY,
  );

  if (days === 0) return { label: "Today", isIso: false };
  if (days === 1) return { label: "Yesterday", isIso: false };
  if (days > 1 && days < 7) {
    return { label: WEEKDAY_DATE.format(parseIsoDate(isoDate)), isIso: false };
  }

  return { label: isoDate, isIso: true };
}

/**
 * Each row's change against the previous actual weigh-in.
 *
 * `rows` is newest first, so the scan runs backwards from the oldest entry and
 * carries the last non-null weight forward. Macro-only days do not reset the
 * baseline; a day without a scale reading is not a zero.
 */
function withChanges(
  rows: DailyMetricDto[],
): Array<{ row: DailyMetricDto; changeKg: number | null }> {
  const changeByDate = new Map<string, number>();
  let olderWeightKg: number | null = null;

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.weightKg === null) continue;

    if (olderWeightKg !== null) {
      changeByDate.set(row.date, roundTenths(row.weightKg - olderWeightKg));
    }
    olderWeightKg = row.weightKg;
  }

  return rows.map((row) => ({
    row,
    changeKg: changeByDate.get(row.date) ?? null,
  }));
}

function Missing({ label = "Not recorded" }: { label?: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

type MetricsHistoryTableProps = {
  /** Newest first, as returned by `getDailyMetricHistory`. */
  rows: DailyMetricDto[];
  selectedDate: string;
  /** The user's calendar day, for "Today"/"Yesterday". */
  today: string;
};

/**
 * The window's rows as a ruled ledger.
 *
 * No zebra, no fill band and no row-actions column: only the selected day gets
 * a quiet `bg-muted`. The date opens that day for editing; the change is
 * computed against the previous weigh-in, so a skipped day never reads as a
 * loss of zero.
 */
export function MetricsHistoryTable({
  rows,
  selectedDate,
  today,
}: MetricsHistoryTableProps) {
  const entries = withChanges(rows);

  return (
    <section
      aria-labelledby="history-heading"
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="history-heading" className="text-base font-medium">
          History
        </h2>

        <Link
          href="/measurements"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Body measurements
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-1.5">
          <p className="text-muted-foreground text-sm">
            No entries in the last 30 days.
          </p>
          <Link
            href="#entry"
            className="focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Log an entry
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-rule text-muted-foreground border-b text-xs">
                <th scope="col" className="py-2 pr-4 text-left font-normal">
                  Date
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 pl-4 text-right font-normal whitespace-nowrap"
                >
                  Weight (kg)
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 pl-4 text-right font-normal whitespace-nowrap"
                >
                  Change (kg)
                </th>
                <th
                  scope="col"
                  className="hidden w-[32%] py-2 pl-4 text-left font-normal sm:table-cell"
                >
                  Note
                </th>
              </tr>
            </thead>

            <tbody className="divide-rule divide-y">
              {entries.map(({ row, changeKg }) => {
                const isSelected = row.date === selectedDate;
                const { label, isIso } = formatDateLabel(row.date, today);

                return (
                  <tr
                    key={row.date}
                    className={cn("h-12", isSelected && "bg-muted")}
                  >
                    <td className="pr-4 align-middle">
                      <Link
                        href={`/metrics?date=${row.date}`}
                        aria-current={isSelected ? "date" : undefined}
                        className={cn(
                          "focus-visible:ring-ring/50 -mx-1 inline-flex h-11 items-center rounded-md px-1 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none",
                          isSelected ? "font-medium" : "font-normal",
                        )}
                      >
                        <time
                          dateTime={row.date}
                          className={cn(isIso && "font-mono tabular-nums")}
                        >
                          {label}
                        </time>
                      </Link>
                    </td>

                    <td className="pr-4 pl-4 text-right font-mono align-middle tabular-nums">
                      {row.weightKg === null ? (
                        <Missing />
                      ) : (
                        formatKg(row.weightKg)
                      )}
                    </td>

                    <td className="pr-4 pl-4 text-right font-mono align-middle tabular-nums">
                      {changeKg === null ? (
                        <Missing label="No earlier weigh-in" />
                      ) : (
                        <span
                          className={cn(
                            changeKg > 0 && "text-positive",
                            changeKg < 0 && "text-negative",
                            changeKg === 0 && "text-muted-foreground",
                          )}
                        >
                          {formatSignedKg(changeKg)}
                        </span>
                      )}
                    </td>

                    <td className="hidden w-[32%] pl-4 align-middle sm:table-cell">
                      {row.notes === null ? (
                        <span
                          className="text-muted-foreground"
                          aria-label="No note"
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className="text-muted-foreground block truncate"
                          title={row.notes}
                        >
                          {row.notes}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
