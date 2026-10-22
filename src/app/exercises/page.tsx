import type { Metadata } from "next";
import { Suspense } from "react";

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
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Exercise library</h1>
        <p className="text-muted-foreground max-w-[62ch] text-sm">
          1,300+ exercises with the muscles they work and step-by-step form cues.
        </p>
      </header>

      <Suspense fallback={<ExerciseLibrarySkeleton />}>
        <ExerciseLibrary searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
