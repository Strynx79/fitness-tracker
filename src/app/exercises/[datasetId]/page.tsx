import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell } from "@/app/_components/page-shell";
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
 * would make the route uncached under Cache Components. The back link and the
 * title stream with the exercise, so the skeleton keeps their place.
 */
export default function ExerciseDetailPage({
  params,
}: PageProps<"/exercises/[datasetId]">) {
  return (
    <PageShell>
      <Suspense fallback={<ExerciseDetailSkeleton />}>
        <ExerciseDetailContent params={params} />
      </Suspense>
    </PageShell>
  );
}
