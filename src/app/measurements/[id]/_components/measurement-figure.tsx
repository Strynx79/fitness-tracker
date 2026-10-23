import { cn } from "@/lib/utils";

import { formatChange, formatValue } from "@/app/measurements/_components/measurement-format";

type MeasurementFigureProps = {
  /** The newest reading anywhere in the type's history, or `null`. */
  latestValue: number | null;
  /** Latest minus the reading before it; `null` with fewer than two readings. */
  change: number | null;
  unit: string;
  className?: string;
};

/**
 * The screen's answer, before anything else.
 *
 * One surface, two figures: the latest reading leads at 30px in the data blue
 * (the only blue figure on the screen), and the change sits beside it at 20px,
 * coloured by direction. Both keep their label when the value is missing,
 * because "no reading yet" is a different fact from "this type does not exist".
 */
export function MeasurementFigure({
  latestValue,
  change,
  unit,
  className,
}: MeasurementFigureProps) {
  return (
    <section
      aria-label="Latest reading"
      className={cn(
        "bg-card flex flex-wrap items-end gap-x-10 gap-y-4 rounded-lg px-5 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      <dl className="flex flex-col gap-1.5">
        <dt className="text-muted-foreground text-xs">Latest</dt>
        <dd className="flex items-baseline gap-1.5">
          {latestValue === null ? (
            <span className="text-muted-foreground font-mono text-[30px] leading-none">
              <span aria-hidden>—</span>
              <span className="sr-only">No readings</span>
            </span>
          ) : (
            <>
              <span className="text-data font-mono text-[30px] leading-none font-medium tabular-nums">
                {formatValue(latestValue)}
              </span>
              <span className="text-muted-foreground text-xs">{unit}</span>
            </>
          )}
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5">
        <dt className="text-muted-foreground text-xs">Change</dt>
        <dd className="flex items-baseline gap-1.5">
          {change === null ? (
            <span className="text-muted-foreground font-mono text-xl leading-none">
              <span aria-hidden>—</span>
              <span className="sr-only">No previous reading</span>
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "font-mono text-xl leading-none font-medium tabular-nums",
                  change > 0 && "text-positive",
                  change < 0 && "text-negative",
                  change === 0 && "text-muted-foreground",
                )}
              >
                {formatChange(change)}
              </span>
              <span className="text-muted-foreground text-xs">{unit}</span>
            </>
          )}
        </dd>
      </dl>
    </section>
  );
}
