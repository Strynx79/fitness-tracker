import { cn } from "@/lib/utils";

import { formatKg, formatSignedKg, roundTenths } from "./weight-format";

type MetricsKpisProps = {
  /** The newest weigh-in anywhere in the account, or `null`. */
  currentKg: number | null;
  /** `latest - baseline` over roughly a week; `null` with nothing to compare. */
  change7dKg: number | null;
  /** `latest - goal`; positive means above the goal. */
  deltaKg: number | null;
  className?: string;
};

/** A real em dash, never "NaN" and never a stand-in zero. */
function Missing({ size, label }: { size: "lead" | "sibling"; label: string }) {
  return (
    <span
      className={cn(
        "text-muted-foreground leading-none",
        size === "lead" ? "text-[30px]" : "text-xl",
      )}
    >
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The screen's answer row.
 *
 * One surface split by rules, not three cards: the current weight leads (30px,
 * the only blue figure on the screen), and the two comparisons sit beside it as
 * evidence. Every cell keeps its label when its value is missing, because "we
 * have no weigh-in" is a different fact from "this block does not exist".
 */
export function MetricsKpis({
  currentKg,
  change7dKg,
  deltaKg,
  className,
}: MetricsKpisProps) {
  const change = change7dKg === null ? null : roundTenths(change7dKg);

  return (
    <section
      aria-label="Weight summary"
      className={cn(
        "bg-card divide-rule grid grid-cols-1 divide-y rounded-lg sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Current</dt>
        <dd className="flex items-baseline gap-1.5">
          {currentKg === null ? (
            <Missing size="lead" label="No weigh-in" />
          ) : (
            <>
              <span className="text-data font-mono text-[30px] leading-none font-medium tabular-nums">
                {formatKg(currentKg)}
              </span>
              <span className="text-muted-foreground text-xs">kg</span>
            </>
          )}
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">7-day change</dt>
        <dd className="flex items-baseline gap-1.5">
          {change === null ? (
            <Missing size="sibling" label="No comparison" />
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
                {formatSignedKg(change)}
              </span>
              <span className="text-muted-foreground text-xs">kg</span>
            </>
          )}
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">To goal</dt>
        <dd className="flex items-baseline gap-1.5">
          {deltaKg === null ? (
            <Missing size="sibling" label="No goal or weigh-in" />
          ) : (
            <>
              <span className="font-mono text-xl leading-none font-medium tabular-nums">
                {formatSignedKg(deltaKg)}
              </span>
              <span className="text-muted-foreground text-xs">kg</span>
            </>
          )}
        </dd>
      </dl>
    </section>
  );
}
