import type { Metadata } from "next";
import { Suspense } from "react";

import {
  DailyMetricForm,
  type DailyMetricFormValues,
} from "@/app/metrics/_components/daily-metric-form";
import { MetricsDateNav } from "@/app/metrics/_components/metrics-date-nav";
import { MetricsHistoryTable } from "@/app/metrics/_components/metrics-history-table";
import { MetricsSkeleton } from "@/app/metrics/_components/metrics-skeleton";
import { WeightTrendChart } from "@/app/metrics/_components/weight-trend-chart";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import {
  buildWeightSeries,
  getDailyMetric,
  getDailyMetricHistory,
} from "@/lib/daily-metrics";
import { addDays, isIsoDate, todayIso } from "@/lib/date";

export const metadata: Metadata = {
  title: "Daily metrics",
};

/** Window length for the trend + history, in days (inclusive of today). */
const HISTORY_DAYS = 30;

/** An untouched input submits "", which the schema reads as `null` (unknown). */
function toInputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Resolve `?date=` without trusting it.
 *
 * `searchParams.date` can be a string, an array (repeated params) or absent,
 * and a hand-edited `?date=abc` must render today rather than throw inside
 * `parseIsoDate`/`isoDateRange` and 500 the route.
 */
function resolveSelectedDate(
  raw: string | string[] | undefined,
  fallback: string,
): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return candidate !== undefined && candidate !== "" && isIsoDate(candidate)
    ? candidate
    : fallback;
}

export default function MetricsPage({ searchParams }: PageProps<"/metrics">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      {/* Static shell: renders immediately while the day's data streams in. */}
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Daily metrics</h1>
        <p className="text-muted-foreground text-sm">
          Weight, calories and protein for one day, plus a {HISTORY_DAYS}-day weight
          trend.
        </p>
      </header>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * Everything that depends on the request.
 *
 * `searchParams` and the DB reads are awaited *here*, inside the Suspense
 * boundary: awaiting them in the page body would block prerendering and fail
 * `next build` under Cache Components. Nothing is cached (`use cache` is
 * deliberately absent) so a saved entry shows up immediately.
 */
async function MetricsContent({
  searchParams,
}: Pick<PageProps<"/metrics">, "searchParams">) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const today = todayIso(user.timezone);
  const selectedDate = resolveSelectedDate(params.date, today);

  const windowEnd = today;
  const windowStart = addDays(windowEnd, -(HISTORY_DAYS - 1));

  // One history read feeds both the chart and the table.
  const [history, metric] = await Promise.all([
    getDailyMetricHistory(user.id, windowStart, windowEnd),
    getDailyMetric(user.id, selectedDate),
  ]);

  const series = buildWeightSeries(history, windowStart, windowEnd);

  const defaultValues: DailyMetricFormValues = {
    weightKg: toInputValue(metric?.weightKg ?? null),
    calories: toInputValue(metric?.calories ?? null),
    proteinG: toInputValue(metric?.proteinG ?? null),
    notes: metric?.notes ?? "",
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <MetricsDateNav selectedDate={selectedDate} today={today} />
        </CardContent>
      </Card>

      {/*
        Keyed by date: the inputs are uncontrolled, so `defaultValue` only
        applies on mount. Without the key, navigating to another day would keep
        the previous day's values in the form.
      */}
      <DailyMetricForm
        key={selectedDate}
        selectedDate={selectedDate}
        defaultValues={defaultValues}
      />

      <WeightTrendChart data={series} days={HISTORY_DAYS} />

      <MetricsHistoryTable rows={history} selectedDate={selectedDate} />
    </div>
  );
}
