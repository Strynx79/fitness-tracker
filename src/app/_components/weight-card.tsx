import { DashboardPanel } from "@/app/_components/dashboard-panel";
import { EmptyState } from "@/app/_components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { getWeightSummary } from "@/lib/daily-metrics";
import { parseIsoDate } from "@/lib/date";
import { formatShortDate } from "@/lib/workout-format";

/**
 * Weights are stored to two decimals, but the panel is a headline, not a table.
 * `maximumFractionDigits` drops trailing zeros, so 79.80 renders as "79.8".
 */
const KG = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

/** Below this the difference is rounding noise, not a direction. */
const NEUTRAL_KG = 0.05;

/**
 * The baseline is a date-only `YYYY-MM-DD` value, so it is formatted at its
 * UTC-midnight instant. A user's zone would slide the day backwards for anyone
 * west of UTC. No weekday: the trend line names the span the delta covers.
 */
const TREND_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatKg(value: number): string {
  return KG.format(value);
}

/**
 * Distance from goal, phrased by direction. `null` is a missing goal, never a
 * zero delta — a user without a target should not read "at goal".
 */
function GoalLine({
  deltaKg,
  goalKg,
}: {
  deltaKg: number | null;
  goalKg: number | null;
}) {
  if (goalKg === null || deltaKg === null) {
    return <p className="text-muted-foreground text-sm">No goal set</p>;
  }

  if (Math.abs(deltaKg) < NEUTRAL_KG) {
    return <p className="text-sm">At goal</p>;
  }

  return (
    <p className="text-sm">
      <span className="font-mono tabular-nums">{formatKg(Math.abs(deltaKg))}</span>
      {` kg ${deltaKg > 0 ? "above" : "below"} goal`}
    </p>
  );
}

/**
 * Direction only — down is not automatically good, so the number stays ink
 * rather than green/red. The baseline can be much older than seven days (the
 * data layer looks back to the closest earlier reading), so the label names
 * the actual baseline date instead of claiming a week. `null` means there is
 * no comparison at all, which is not the same as "no change".
 */
function WeeklyChange({
  changeKg,
  baselineDate,
}: {
  changeKg: number | null;
  baselineDate: string | null;
}) {
  if (changeKg === null || baselineDate === null) {
    return <span>No trend yet</span>;
  }

  const since = (
    <time dateTime={baselineDate} className="font-mono tabular-nums">
      {TREND_DATE.format(parseIsoDate(baselineDate))}
    </time>
  );

  if (Math.abs(changeKg) < NEUTRAL_KG) {
    return <span>No change since {since}</span>;
  }

  return (
    <span>
      <span className="text-foreground font-mono tabular-nums">
        {`${changeKg > 0 ? "+" : "−"}${formatKg(Math.abs(changeKg))} kg`}
      </span>{" "}
      since {since}
    </span>
  );
}

/**
 * The screen's answer figure.
 *
 * When a weigh-in exists the number is the one coloured thing on the page: it
 * answers "what is my state today?" and the blue belongs to data, never chrome.
 * With no weigh-in nothing is coloured and the block keeps its frame, heading
 * and one route in (`/metrics`).
 */
export async function WeightCard() {
  const user = await getCurrentUser();
  const summary = await getWeightSummary(user.id);

  const { latest, goalKg } = summary;

  if (latest === null) {
    return (
      <DashboardPanel title="Weight" headingId="weight-heading">
        <EmptyState
          description="No weigh-in yet."
          action={{ href: "/metrics", label: "Log a weigh-in" }}
        />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      title="Weight"
      headingId="weight-heading"
      action={{ href: "/metrics", label: "Metrics" }}
    >
      <div className="flex items-baseline gap-1.5">
        <p className="text-data font-mono text-3xl leading-none font-medium tabular-nums">
          {formatKg(latest.weightKg)}
        </p>
        <span className="text-muted-foreground text-xs">kg</span>
      </div>

      <div className="mt-2">
        <GoalLine deltaKg={summary.deltaKg} goalKg={goalKg} />
      </div>

      {/*
        `latest.date` is a date-only value, so it is formatted against the
        UTC-midnight instant with `timeZone: "UTC"` — the same convention as the
        metrics table. Formatting it in the user's zone would slide the day
        backwards for anyone west of UTC.
      */}
      <div className="border-rule text-muted-foreground mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t pt-3 text-[13px]">
        <span>
          Weighed{" "}
          <time dateTime={latest.date} className="text-foreground font-mono tabular-nums">
            {formatShortDate(latest.date, "UTC")}
          </time>
        </span>

        <WeeklyChange
          changeKg={summary.change7dKg}
          baselineDate={summary.baseline?.date ?? null}
        />
      </div>
    </DashboardPanel>
  );
}
