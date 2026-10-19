import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, Scale } from "lucide-react";

import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getWeightSummary } from "@/lib/daily-metrics";
import { formatShortDate } from "@/lib/workout-format";

/**
 * Weights are stored to two decimals, but the card is a headline, not a table.
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
function describeGoal(deltaKg: number | null, goalKg: number | null): string {
  if (goalKg === null || deltaKg === null) return "No goal set";
  if (Math.abs(deltaKg) < NEUTRAL_KG) return "at goal";

  return `${formatKg(Math.abs(deltaKg))} kg ${
    deltaKg > 0 ? "above" : "below"
  } goal`;
}

/**
 * Direction only — down is not automatically good, so the arrow and number are
 * neutral rather than green/red.
 *
 * The baseline can be much older than seven days (the data layer looks back to
 * the closest earlier reading), so the label names the actual baseline date
 * instead of claiming a week. `null` means there is no comparison at all, which
 * is not the same as "no change".
 */
function WeeklyChange({
  changeKg,
  baselineDate,
}: {
  changeKg: number | null;
  baselineDate: string | null;
}) {
  if (changeKg === null || baselineDate === null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Minus aria-hidden className="size-3.5" />
        No trend yet
      </span>
    );
  }

  const since = TREND_DATE.format(new Date(baselineDate));

  if (Math.abs(changeKg) < NEUTRAL_KG) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1">
        <Minus aria-hidden className="size-3.5" />
        <span>{`No change since ${since}`}</span>
      </span>
    );
  }

  const Icon = changeKg < 0 ? ArrowDown : ArrowUp;

  return (
    <span className="inline-flex items-center gap-1">
      <Icon aria-hidden className="size-3.5" />
      <span className="text-foreground font-medium tabular-nums">
        {`${formatKg(Math.abs(changeKg))} kg since ${since}`}
      </span>
    </span>
  );
}

export async function WeightCard() {
  const user = await getCurrentUser();
  const summary = await getWeightSummary(user.id);

  const { latest, goalKg } = summary;

  if (latest === null) {
    return (
      <EmptyState
        icon={Scale}
        title="No weigh-in yet"
        description="Log your weight in Daily metrics and your trend will show up here."
        action={{ href: "/metrics", label: "Log a weigh-in" }}
      />
    );
  }

  return (
    <section aria-labelledby="weight-heading">
      <Link
        href="/metrics"
        className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="transition-colors hover:bg-muted/40">
          <CardHeader>
            {/*
              A real heading (CardTitle is a div), so the card is announced in a
              heading list. The link's name now comes from its content.
            */}
            <h2
              id="weight-heading"
              className="font-heading text-base leading-snug font-medium"
            >
              Weight
            </h2>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <span className="text-4xl leading-none font-semibold tracking-tight tabular-nums">
                {formatKg(latest.weightKg)}
              </span>
              <span className="text-muted-foreground pb-0.5 text-sm">kg</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-medium">
                {describeGoal(summary.deltaKg, goalKg)}
              </span>
              {goalKg === null ? null : (
                <span className="text-muted-foreground text-sm">
                  Goal {formatKg(goalKg)} kg
                </span>
              )}
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3 text-xs">
              {/*
                `latest.date` is a date-only value, so it is formatted against the
                UTC-midnight instant with `timeZone: "UTC"` — the same convention
                as the metrics table. Formatting it in the user's zone would slide
                the day backwards for anyone west of UTC.
              */}
              <span>
                Weighed{" "}
                <time dateTime={latest.date} className="text-foreground font-medium">
                  {formatShortDate(latest.date, "UTC")}
                </time>
              </span>
              <WeeklyChange
                changeKg={summary.change7dKg}
                baselineDate={summary.baseline?.date ?? null}
              />
            </div>
          </CardContent>
        </Card>
      </Link>
    </section>
  );
}
