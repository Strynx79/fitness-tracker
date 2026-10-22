import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { MeasurementList } from "@/app/measurements/_components/measurement-list";
import { NewMeasurementForm } from "@/app/measurements/_components/new-measurement-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getMeasurementTypes } from "@/lib/measurements";

export const metadata: Metadata = {
  title: "Measurements",
};

/**
 * Body measurements the user tracks, with the latest reading and its change.
 *
 * `weekdays`-style scheduling does not apply here; this is a flat list the user
 * grows and prunes.
 */
export default function MeasurementsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/metrics" label="Metrics" />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Measurements</h1>
        <p className="text-muted-foreground text-sm">
          Waist, chest, arms — anything you want a trend for.
        </p>
      </header>

      <Suspense fallback={<MeasurementsSkeleton />}>
        <MeasurementsContent />
      </Suspense>
    </main>
  );
}

async function MeasurementsContent() {
  const user = await getCurrentUser();
  const types = await getMeasurementTypes(user.id);

  return (
    <div className="flex flex-col gap-4">
      <NewMeasurementForm />
      <MeasurementList types={types} />
    </div>
  );
}

function MeasurementsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
