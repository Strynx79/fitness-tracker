import Link from "next/link";

import type { MeasurementTypeSummary } from "@/lib/measurements";
import { cn } from "@/lib/utils";

import {
  formatChange,
  formatDateLabel,
  formatValue,
  roundTenths,
} from "./measurement-format";

/**
 * Column tracks shared by the header row and every type row, so the latest
 * figure, the change and the update land on the same vertical rule from row to
 * row. The phone drops the Updated track and carries that fact in the name's
 * subline instead of squeezing four columns into 360px.
 */
const COLUMNS =
  "grid-cols-[minmax(0,1fr)_92px_80px] sm:grid-cols-[minmax(0,1fr)_140px_112px_144px] lg:grid-cols-[minmax(0,1fr)_160px_128px_160px]";

type MeasurementsTableProps = {
  types: MeasurementTypeSummary[];
  /** The user's calendar day, for "Today"/"Yesterday". */
  today: string;
  className?: string;
};

/** A real em dash, never "NaN" and never a stand-in zero. */
function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The tracked types as a ruled ledger.
 *
 * One row per type, newest reading on the right where a number column belongs.
 * The whole row is the link, so a thumb between sets hits it without aiming at
 * a chevron. No zebra, no fill band, no per-row actions: the only action on
 * this screen is the create form below.
 */
export function MeasurementsTable({
  types,
  today,
  className,
}: MeasurementsTableProps) {
  return (
    <section aria-labelledby="measurements-heading" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="measurements-heading" className="text-base font-medium">
          Tracked types
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {types.length === 0
            ? "None"
            : `${types.length} type${types.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="mt-4 flex flex-col">
        <div
          className={cn(
            "border-rule text-muted-foreground grid items-center gap-x-4 border-b pb-2 text-xs sm:gap-x-6",
            COLUMNS,
          )}
        >
          <span>Measurements</span>
          <span className="text-right">Latest</span>
          <span className="text-right">Change</span>
          <span className="hidden text-right sm:block">Updated</span>
        </div>

        {types.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">
            No measurements tracked yet.
          </p>
        ) : (
          <ul className="divide-rule divide-y">
            {types.map((type) => {
              const change =
                type.changeFromPrevious === null
                  ? null
                  : roundTenths(type.changeFromPrevious);
              const updated =
                type.latestDateIso === null
                  ? null
                  : formatDateLabel(type.latestDateIso, today);

              return (
                <li key={type.id}>
                  <Link
                    href={`/measurements/${type.id}`}
                    className={cn(
                      "hover:bg-card focus-visible:ring-ring/50 grid min-h-[52px] items-center gap-x-4 py-2.5 transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:outline-none sm:gap-x-6",
                      COLUMNS,
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {type.name}
                      </span>
                      {updated === null ? null : (
                        <span className="text-muted-foreground truncate text-[13px] sm:hidden">
                          Updated {updated.label}
                        </span>
                      )}
                    </span>

                    <span className="text-right whitespace-nowrap">
                      {type.latestValue === null ? (
                        <Missing label="No readings" />
                      ) : (
                        <span className="inline-flex items-baseline justify-end gap-1">
                          <span className="font-mono text-sm tabular-nums">
                            {formatValue(type.latestValue)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {type.unit}
                          </span>
                        </span>
                      )}
                    </span>

                    <span className="text-right whitespace-nowrap">
                      {change === null ? (
                        <Missing label="No previous reading" />
                      ) : (
                        <span className="inline-flex items-baseline justify-end gap-1">
                          <span
                            className={cn(
                              "font-mono text-sm tabular-nums",
                              change > 0 && "text-positive",
                              change < 0 && "text-negative",
                              change === 0 && "text-muted-foreground",
                            )}
                          >
                            {formatChange(change)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {type.unit}
                          </span>
                        </span>
                      )}
                    </span>

                    <span className="hidden text-right text-[13px] sm:block">
                      {type.latestDateIso === null || updated === null ? (
                        <Missing label="No readings" />
                      ) : (
                        <time
                          dateTime={type.latestDateIso}
                          className={cn(
                            "text-muted-foreground",
                            updated.isIso && "font-mono tabular-nums",
                          )}
                        >
                          {updated.label}
                        </time>
                      )}
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
