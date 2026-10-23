import { cn } from "@/lib/utils";

type RoutineKpisProps = {
  exerciseCount: number;
  /** Sum of every non-null target; `null` when no exercise has a target. */
  setsPlanned: number | null;
  /** Number of weekdays the routine is scheduled for. */
  daysPerWeek: number;
  className?: string;
};

/** A real em dash, never a stand-in zero. */
function Missing({ label, size }: { label: string; size: "lead" | "sibling" }) {
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
 * The routine's size at a glance.
 *
 * One surface split by rules, not three cards. Exercises lead because that is
 * what the screen is for; planned sets and the weekly frequency sit beside it as
 * supporting evidence. Sets are an em dash — not "0" — until at least one
 * exercise carries a target, because a plan without targets has no planned sets
 * to report.
 */
export function RoutineKpis({
  exerciseCount,
  setsPlanned,
  daysPerWeek,
  className,
}: RoutineKpisProps) {
  return (
    <section
      aria-label="Routine totals"
      className={cn(
        "bg-card divide-rule grid grid-cols-1 divide-y rounded-lg sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Exercises</dt>
        <dd>
          <span className="font-mono text-[30px] leading-none font-medium tabular-nums">
            {exerciseCount}
          </span>
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Sets planned</dt>
        <dd className="flex items-baseline gap-1.5">
          {setsPlanned === null ? (
            <Missing size="sibling" label="No target sets" />
          ) : (
            <span className="font-mono text-xl leading-none font-medium tabular-nums">
              {setsPlanned}
            </span>
          )}
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Days per week</dt>
        <dd className="flex items-baseline gap-1.5">
          <span className="font-mono text-xl leading-none font-medium tabular-nums">
            {daysPerWeek}
          </span>
        </dd>
      </dl>
    </section>
  );
}
