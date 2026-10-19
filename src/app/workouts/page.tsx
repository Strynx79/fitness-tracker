import type { Metadata } from "next";
import { Suspense } from "react";

import { NewSessionForm } from "@/app/workouts/_components/new-session-form";
import { SessionList } from "@/app/workouts/_components/session-list";
import { WorkoutsSkeleton } from "@/app/workouts/_components/workouts-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutSessionList } from "@/lib/workouts";

export const metadata: Metadata = {
  title: "Workouts",
};

/**
 * Workout history and the start-session form.
 *
 * The page body stays static; everything that needs the database streams behind
 * one Suspense boundary. Awaiting `getCurrentUser`/`getWorkoutSessionList` in
 * the page itself would block prerendering and fail `next build` under Cache
 * Components.
 */
export default function WorkoutsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Workouts</h1>
        <p className="text-muted-foreground text-sm">
          Log a set at a time. Every exercise shows the last top set you need to
          beat.
        </p>
      </header>

      <Suspense fallback={<WorkoutsSkeleton />}>
        <WorkoutsContent />
      </Suspense>
    </main>
  );
}

async function WorkoutsContent() {
  const user = await getCurrentUser();
  const sessions = await getWorkoutSessionList(user.id);

  return (
    <div className="flex flex-col gap-4">
      <NewSessionForm />
      <SessionList sessions={sessions} timezone={user.timezone} />
    </div>
  );
}
