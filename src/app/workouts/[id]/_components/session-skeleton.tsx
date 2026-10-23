import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the session screen as an empty session resolves it — the header, the
 * KPI strip and one blank exercise panel — so the swap-in does not jump. No
 * set rows or figures are sketched: a bar that pretends to be a weight is a
 * number the user does not have.
 */
export function SessionSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      <div className="bg-card divide-rule mt-9 grid grid-cols-1 divide-y rounded-lg sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 px-5 py-4 sm:px-6 sm:py-5"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg p-5 sm:p-6">
        <Skeleton className="h-5 w-24" />
        <div className="mt-3 space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="mt-4 flex h-10 items-center">
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
