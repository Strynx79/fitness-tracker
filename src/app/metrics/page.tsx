import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import {
  DailyMetricForm,
  type DailyMetricFormValues,
} from "@/app/metrics/_components/daily-metric-form";
import { MetricsDateNav } from "@/app/metrics/_components/metrics-date-nav";
import { MetricsHistoryTable } from "@/app/metrics/_components/metrics-history-table";
import { MetricsKpis } from "@/app/metrics/_components/metrics-kpis";
import { MetricsSkeleton } from "@/app/metrics/_components/metrics-skeleton";
import { WeightTrendChart } from "@/app/metrics/_components/weight-trend-chart";
import { getCurrentUser } from "@/lib/auth";
import {
  buildWeightSeries,
  getDailyMetric,
  getDailyMetricHistory,
  getWeightSummary,
} from "@/lib/daily-metrics";
import { addDays, isIsoDate, parseIsoDate, todayIso } from "@/lib/date";

export const metadata: Metadata = {
  title: "Metrics",
};

/** Window length for the trend + history, in days (inclusive of today). */
const HISTORY_DAYS = 30;

const MS_PER_DAY = 86_400_000;

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

/**
 * The header's fact about the data, not about the interface.
 *
 * The newest weigh-in can be much older than the 30-day window, which is
 * exactly why the gap is stated in words here rather than implied by the chart.
 */
function describeLastWeighIn(lastDate: string | null, today: string): string {
  if (lastDate === null) return "No weigh-in yet.";

  const days = Math.round(
    (parseIsoDate(today).getTime() - parseIsoDate(lastDate).getTime()) / MS_PER_DAY,
  );

  if (days <= 0) return "Last weigh-in today.";
  if (days === 1) return "Last weigh-in yesterday.";
  return `Last weigh-in ${days} days ago.`;
}

export default function MetricsPage({ searchParams }: PageProps<"/metrics">) {
  return (
    <PageShell width="wide">
      {/*
        The header's description and its date control both depend on request
        data (the newest weigh-in and the selected day), so the whole screen —
        header included — sits behind one boundary. Splitting it would mean
        reading the same summary twice.
      */}
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
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

  // One history read feeds both the chart and the table; the summary answers
  // the header and the KPI strip.
  const [history, metric, summary] = await Promise.all([
    getDailyMetricHistory(user.id, windowStart, windowEnd),
    getDailyMetric(user.id, selectedDate),
    getWeightSummary(user.id),
  ]);

  const series = buildWeightSeries(history, windowStart, windowEnd);

  const defaultValues: DailyMetricFormValues = {
    weightKg: toInputValue(metric?.weightKg ?? null),
    calories: toInputValue(metric?.calories ?? null),
    proteinG: toInputValue(metric?.proteinG ?? null),
    notes: metric?.notes ?? "",
  };

  return (
    <>
      <ScreenHeader
        title="Metrics"
        description={describeLastWeighIn(summary.latest?.date ?? null, today)}
        action={<MetricsDateNav selectedDate={selectedDate} today={today} />}
      />

      <MetricsKpis
        currentKg={summary.latest?.weightKg ?? null}
        change7dKg={summary.change7dKg}
        deltaKg={summary.deltaKg}
        // The header-to-first-block rhythm on data screens is 60px; PageShell
        // already supplies 24px of it.
        className="mt-9"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <WeightTrendChart
          data={series}
          days={HISTORY_DAYS}
          className="lg:col-span-2"
        />

        {/*
          Keyed by date: the inputs are uncontrolled, so `defaultValue` only
          applies on mount. Without the key, navigating to another day would keep
          the previous day's values in the form.
        */}
        <DailyMetricForm
          key={selectedDate}
          selectedDate={selectedDate}
          today={today}
          defaultValues={defaultValues}
        />
      </div>

      <MetricsHistoryTable
        rows={history}
        selectedDate={selectedDate}
        today={today}
      />
    </>
  );
}
