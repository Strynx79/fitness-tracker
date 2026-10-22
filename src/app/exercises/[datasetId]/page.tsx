import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

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
      <Link
        href="/exercises"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All exercises
      </Link>

      <Suspense fallback={<ExerciseDetailSkeleton />}>
        <ExerciseDetailContent params={params} />
      </Suspense>
    </main>
  );
}
