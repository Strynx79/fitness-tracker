import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { LogMeasurementForm } from "@/app/measurements/[id]/_components/log-measurement-form";
import { MeasurementChart } from "@/app/measurements/[id]/_components/measurement-chart";
import { MeasurementFigure } from "@/app/measurements/[id]/_components/measurement-figure";
import {
  DeleteMeasurementTypeButton,
  MeasurementHistory,
} from "@/app/measurements/[id]/_components/measurement-history";
import {
  describeRecency,
  formatValue,
  roundTenths,
} from "@/app/measurements/_components/measurement-format";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import { getMeasurement, type MeasurementPoint } from "@/lib/measurements";

export const metadata: Metadata = {
  title: "Measurement",
};

/**
 * Ten decades, in days.
 *
 * `getMeasurement` defaults to a 120-day window, which is shorter than the gap
 * some people leave between measurements. Reading a wider window is what lets
 * the header and the figure tell the truth: a type whose last reading is two
 * years old must say so, not claim it has no readings at all.
 */
const READING_WINDOW_DAYS = 36_500;

/** The newest reading, or `null` when the type has never been measured. */
function latestPoint(points: MeasurementPoint[]): MeasurementPoint | null {
  return points.length === 0 ? null : points[points.length - 1];
}

/** Latest minus the reading before it; `null` with fewer than two readings. */
function latestChange(points: MeasurementPoint[]): number | null {
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const previous = points[points.length - 2];

  return roundTenths(latest.value - previous.value);
}

/** The header's sentence: the latest reading itself, dated in words. */
function describeLatest(
  points: MeasurementPoint[],
  unit: string,
  today: string,
): string {
  const latest = latestPoint(points);
  if (latest === null) return "No readings yet.";

  return `Latest ${formatValue(latest.value)} ${unit}, ${describeRecency(latest.date, today)}.`;
}

/**
 * One measurement: the figure first, then the trend, then the history.
 *
 * `params`, the query and the 404 decision all live inside the boundary, so a
 * missing id cannot make the route uncached above its Suspense fallback.
 */
export default function MeasurementPage({
  params,
}: PageProps<"/measurements/[id]">) {
  return (
    <PageShell width="wide">
      <Suspense fallback={<MeasurementSkeleton />}>
        <MeasurementContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function MeasurementContent({
  params,
}: Pick<PageProps<"/measurements/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const measurement = await getMeasurement(user.id, id, READING_WINDOW_DAYS);

  // Missing and not-owned are the same answer.
  if (measurement === null) notFound();

  const today = todayIso(user.timezone);
  const latest = latestPoint(measurement.points);

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink
          href="/measurements"
          label="Measurements"
          className="-ml-2 h-8 px-2 text-[13px]"
        />
        <ScreenHeader
          title={measurement.name}
          description={describeLatest(measurement.points, measurement.unit, today)}
        />
      </div>

      <MeasurementFigure
        latestValue={latest === null ? null : latest.value}
        change={latestChange(measurement.points)}
        unit={measurement.unit}
        // The header-to-figure rhythm is 60px; PageShell supplies 24px of it.
        className="mt-9"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <MeasurementChart
          points={measurement.points}
          className="lg:col-span-2"
        />

        <LogMeasurementForm
          typeId={measurement.id}
          unit={measurement.unit}
          today={today}
        />
      </div>

      <MeasurementHistory
        points={measurement.points}
        unit={measurement.unit}
        today={today}
      />

      <DeleteMeasurementTypeButton typeId={measurement.id} />
    </>
  );
}

function MeasurementSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      <Skeleton className="bg-card mt-9 h-[96px] w-full rounded-lg" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="bg-card h-[382px] w-full rounded-lg lg:col-span-2" />
        <Skeleton className="bg-card h-[344px] w-full rounded-lg" />
      </div>

      <Skeleton className="bg-card h-[300px] w-full rounded-lg" />
    </div>
  );
}
