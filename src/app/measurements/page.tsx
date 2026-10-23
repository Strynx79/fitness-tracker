import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { describeRecency } from "@/app/measurements/_components/measurement-format";
import { MeasurementsTable } from "@/app/measurements/_components/measurements-table";
import { NewMeasurementForm } from "@/app/measurements/_components/new-measurement-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import {
  getMeasurementTypes,
  type MeasurementTypeSummary,
} from "@/lib/measurements";

export const metadata: Metadata = {
  title: "Measurements",
};

/**
 * The header's fact about the data, not about the interface.
 *
 * "3 types tracked, last reading 12 days ago" answers the screen's question in
 * one line. A type with no readings is not counted as an update, and an account
 * with types but no readings says so rather than implying a measurement.
 */
function describeTypes(
  types: MeasurementTypeSummary[],
  today: string,
): string {
  if (types.length === 0) return "No measurements yet.";

  const tracked = `${types.length} type${types.length === 1 ? "" : "s"} tracked`;

  const latestDate = types.reduce<string | null>((latest, type) => {
    if (type.latestDateIso === null) return latest;
    if (latest === null || type.latestDateIso > latest) return type.latestDateIso;
    return latest;
  }, null);

  if (latestDate === null) return `${tracked}, no readings yet.`;

  return `${tracked}, last reading ${describeRecency(latestDate, today)}.`;
}

export default function MeasurementsPage() {
  return (
    <PageShell width="wide">
      {/*
        The header states a fact about the data, so it waits with the table —
        one boundary for the whole request-shaped screen, as on `/metrics`.
      */}
      <Suspense fallback={<MeasurementsSkeleton />}>
        <MeasurementsContent />
      </Suspense>
    </PageShell>
  );
}

async function MeasurementsContent() {
  const user = await getCurrentUser();
  const types = await getMeasurementTypes(user.id);
  const today = todayIso(user.timezone);

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink
          href="/metrics"
          label="Metrics"
          className="-ml-2 h-8 px-2 text-[13px]"
        />
        <ScreenHeader
          title="Measurements"
          description={describeTypes(types, today)}
        />
      </div>

      <MeasurementsTable
        types={types}
        today={today}
        // The header-to-first-block rhythm on data screens is 60px; PageShell
        // already supplies 24px of it.
        className="mt-9"
      />

      <NewMeasurementForm />
    </>
  );
}

function MeasurementsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Measurements</h1>
          <Skeleton className="h-4 w-60" />
        </div>
      </div>

      <div className="mt-9 flex flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[52px] w-full rounded-none" />
        ))}
      </div>

      <Skeleton className="bg-card h-[264px] w-full rounded-lg" />
    </div>
  );
}
