import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { ExerciseLibrary } from "@/app/exercises/_components/exercise-library";
import { ExerciseLibrarySkeleton } from "@/app/exercises/_components/exercise-library-skeleton";

export const metadata: Metadata = {
  title: "Exercise library",
};

/**
 * The catalog browser.
 *
 * The header is static; the results and their filters stream behind one
 * Suspense boundary because they depend on `searchParams` (request-time data,
 * which Cache Components forbids above a boundary).
 */
export default function ExercisesPage({
  searchParams,
}: PageProps<"/exercises">) {
  return (
    <PageShell width="wide">
      <ScreenHeader
        title="Exercise library"
        description="1,300+ exercises with the muscles they work and step-by-step form cues."
      />

      <Suspense fallback={<ExerciseLibrarySkeleton />}>
        <ExerciseLibrary searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
