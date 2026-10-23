import { Skeleton } from "@/components/ui/skeleton";

/**
 * The streaming fallback.
 *
 * It mirrors the resolved layout — header, KPI strip, the two-thirds chart with
 * the form beside it, then the table — so the swap-in does not move the page.
 * The skeleton bars are loading chrome, not decoration: every block the real
 * screen draws has a placeholder of the same height.
 */
export function MetricsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-56 rounded-md" />
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="bg-card h-[382px] rounded-lg lg:col-span-2" />
        <Skeleton className="bg-card h-[460px] rounded-lg" />
      </div>

      <Skeleton className="bg-card h-[340px] rounded-lg" />
    </div>
  );
}
