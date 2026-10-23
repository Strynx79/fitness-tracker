import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the streamed detail body: back link and header, media, the meta
 * table, the step list and the licence footer. Geometry only — no stub values
 * that would read as exercise data.
 */
export function ExerciseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-11 w-40 rounded-md" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="bg-card size-32 rounded sm:size-40 lg:size-[180px]" />
        <Skeleton className="h-3 w-48" />
      </div>

      <div className="flex flex-col">
        <div className="border-rule flex items-center justify-between border-b py-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-rule flex h-10 items-center justify-between border-b last:border-b-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28" />
        <div className="flex max-w-[62ch] flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Skeleton className="h-11 w-40 rounded-md" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="border-rule flex flex-col gap-2 border-t pt-4">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
    </div>
  );
}
