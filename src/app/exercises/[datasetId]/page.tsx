import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { ExerciseDetailContent } from "@/app/exercises/[datasetId]/_components/exercise-detail-content";
import { ExerciseDetailSkeleton } from "@/app/exercises/[datasetId]/_components/exercise-detail-skeleton";

export const metadata: Metadata = {
  title: "Exercise",
};

/**
 * One catalog exercise.
 *
 * `params` is a Promise and is awaited inside the boundary together with the
 * query, matching the workout session page: resolving the id in the page body
 * would make the route uncached under Cache Components.
 */
export default function ExerciseDetailPage({
  params,
}: PageProps<"/exercises/[datasetId]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/exercises" label="All exercises" />

      <Suspense fallback={<ExerciseDetailSkeleton />}>
        <ExerciseDetailContent params={params} />
      </Suspense>
    </main>
  );
}
