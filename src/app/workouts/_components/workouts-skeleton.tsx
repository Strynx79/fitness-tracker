import { Skeleton } from "@/components/ui/skeleton";

import { WorkoutSectionTabs } from "@/app/_components/workout-section-tabs";

/**
 * The streaming fallback.
 *
 * It mirrors the screen as a fresh account resolves it — header, the empty
 * today panel, the empty history block and the start form — so the swap-in
 * does not move the page. No rows and no figures are sketched: a bar that
 * pretends to be a count is a number the user does not have.
 */
export function WorkoutsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>

      <WorkoutSectionTabs active="history" />

      <div className="bg-card rounded-lg p-5 sm:p-6">
        <Skeleton className="h-5 w-32" />
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-4 w-52 max-w-full" />
          <div className="flex h-11 items-center">
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <Skeleton className="h-5 w-20" />
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>

      <div className="bg-card rounded-lg p-5 sm:p-6">
        <Skeleton className="h-5 w-36" />
        <div className="mt-4 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-20 w-full" />
          <div className="flex justify-end">
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
