import { formatKgDecimal } from "@/app/workouts/_components/format";
import { cn } from "@/lib/utils";

type SessionKpisProps = {
  /** Every set across every exercise block. Zero is a real count. */
  setCount: number;
  /** `weightKg * reps` over every set; `null` when no set has been logged. */
  volumeKg: number | null;
  /** Number of exercise blocks, logged or not. */
  exerciseCount: number;
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
 * The session's totals.
 *
 * One surface split by rules, not three cards: sets logged leads, volume and
 * the exercise count sit beside it as the supporting evidence. Volume is an em
 * dash — not "0 kg" — until a set exists, because an empty session has no
 * volume to report.
 */
export function SessionKpis({
  setCount,
  volumeKg,
  exerciseCount,
  className,
}: SessionKpisProps) {
  return (
    <section
      aria-label="Session totals"
      className={cn(
        "bg-card divide-rule grid grid-cols-1 divide-y rounded-lg sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Sets logged</dt>
        <dd>
          <span className="font-mono text-[30px] leading-none font-medium tabular-nums">
            {setCount}
          </span>
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Volume</dt>
        <dd className="flex items-baseline gap-1.5">
          {volumeKg === null ? (
            <Missing size="sibling" label="No sets logged" />
          ) : (
            <>
              <span className="font-mono text-xl leading-none font-medium tabular-nums">
                {formatKgDecimal(volumeKg)}
              </span>
              <span className="text-muted-foreground text-xs">kg</span>
            </>
          )}
        </dd>
      </dl>

      <dl className="flex flex-col gap-1.5 px-5 py-4 sm:px-6 sm:py-5">
        <dt className="text-muted-foreground text-xs">Exercises</dt>
        <dd>
          <span className="font-mono text-xl leading-none font-medium tabular-nums">
            {exerciseCount}
          </span>
        </dd>
      </dl>
    </section>
  );
}
