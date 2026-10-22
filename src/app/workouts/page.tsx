import type { Metadata } from "next";
import { Suspense } from "react";

import { NewSessionForm } from "@/app/workouts/_components/new-session-form";
import { SessionList } from "@/app/workouts/_components/session-list";
import { TodayPlan } from "@/app/workouts/_components/today-plan";
import { UpcomingList } from "@/app/workouts/_components/upcoming-list";
import { WorkoutsSkeleton } from "@/app/workouts/_components/workouts-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { todayIso, weekdayInZone } from "@/lib/date";
import { getRoutines } from "@/lib/routines";
import { getUpcomingWorkouts, getWorkoutSessionList } from "@/lib/workouts";

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
  const today = todayIso(user.timezone);

  const [sessions, upcoming, routines] = await Promise.all([
    getWorkoutSessionList(user.id, today),
    getUpcomingWorkouts(user.id, today),
    getRoutines(user.id),
  ]);

  // Routines are planned per weekday in the user's own calendar.
  const weekday = weekdayInZone(new Date(), user.timezone);
  const todayPlan = routines.filter((routine) => routine.weekdays.includes(weekday));

  return (
    <div className="flex flex-col gap-4">
      <TodayPlan routines={todayPlan} weekday={weekday} />
      <UpcomingList workouts={upcoming} />
      <NewSessionForm />
      <SessionList sessions={sessions} timezone={user.timezone} />
    </div>
  );
}
