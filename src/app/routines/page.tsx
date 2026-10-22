import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { NewRoutineForm } from "@/app/routines/_components/new-routine-form";
import { RoutineList } from "@/app/routines/_components/routine-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getRoutines } from "@/lib/routines";

export const metadata: Metadata = {
  title: "Routines",
};

/**
 * Reusable workout plans (Push / Pull / Legs / Upper / Lower).
 *
 * Static header; the list and the create form stream behind one boundary because
 * they need the current user.
 */
export default function RoutinesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/workouts" label="Workouts" />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Routines</h1>
        <p className="text-muted-foreground text-sm">
          Build a plan once, then start it on any day. Assign days of the week to
          see it on the workouts screen.
        </p>
      </header>

      <Suspense fallback={<RoutinesSkeleton />}>
        <RoutinesContent />
      </Suspense>
    </main>
  );
}

async function RoutinesContent() {
  const user = await getCurrentUser();
  const routines = await getRoutines(user.id);

  return (
    <div className="flex flex-col gap-4">
      <NewRoutineForm />
      <RoutineList routines={routines} />
    </div>
  );
}

function RoutinesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
