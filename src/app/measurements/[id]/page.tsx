import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { LogMeasurementForm } from "@/app/measurements/[id]/_components/log-measurement-form";
import { MeasurementChart } from "@/app/measurements/[id]/_components/measurement-chart";
import {
  DeleteMeasurementTypeButton,
  MeasurementHistory,
} from "@/app/measurements/[id]/_components/measurement-history";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import { getMeasurement } from "@/lib/measurements";

export const metadata: Metadata = {
  title: "Measurement",
};

/**
 * One measurement: log a reading, see the trend, review the history.
 *
 * `params` is awaited inside the boundary together with the query, matching the
 * other detail routes under Cache Components.
 */
export default function MeasurementPage({
  params,
}: PageProps<"/measurements/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/measurements" label="All measurements" />

      <Suspense fallback={<MeasurementSkeleton />}>
        <MeasurementContent params={params} />
      </Suspense>
    </main>
  );
}

async function MeasurementContent({
  params,
}: Pick<PageProps<"/measurements/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const measurement = await getMeasurement(user.id, id);

  // Missing and not-owned are the same answer.
  if (measurement === null) notFound();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {measurement.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Measured in {measurement.unit}.
        </p>
      </header>

      <LogMeasurementForm
        typeId={measurement.id}
        unit={measurement.unit}
        today={todayIso(user.timezone)}
      />

      <MeasurementChart points={measurement.points} unit={measurement.unit} />

      {measurement.points.length === 0 ? null : (
        <div className="rounded-xl border p-4">
          <MeasurementHistory
            points={measurement.points}
            unit={measurement.unit}
          />
        </div>
      )}

      <DeleteMeasurementTypeButton typeId={measurement.id} />
    </div>
  );
}

function MeasurementSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
