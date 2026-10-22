import { Skeleton } from "@/components/ui/skeleton";

import { LEDGER_COLUMNS } from "./ledger";

/** One rail group: a heading bar and its option bars. */
function RailGroup({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-20" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );
}

/** Mobile facet strip: wrapped chip bars, then the equipment disclosure. */
function ChipGroup({ bars }: { bars: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-20" />
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: bars }, (_, index) => (
          <Skeleton key={index} className="h-7 w-20 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors the streamed search row, facet rail and result ledger so the swap-in
 * does not jump. The page header lives outside the Suspense boundary and is
 * already on screen.
 *
 * Geometry is imported from `ledger.ts` rather than copied: a skeleton whose
 * tracks drift from the real ones resizes the columns the moment the data
 * lands, which is the shift it exists to prevent.
 */
export function ExerciseLibrarySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full rounded-md sm:flex-1" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Rail: a column of ledger rows on wide screens. */}
        <div className="hidden flex-col gap-6 lg:flex">
          <RailGroup rows={10} />
          <RailGroup rows={8} />
        </div>

        {/* Below `lg` the same facets are wrapped chips and a disclosure row. */}
        <div className="flex flex-col gap-6 lg:hidden">
          <ChipGroup bars={10} />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-4" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>

          <div className="flex flex-col">
            <div
              className={`border-rule hidden items-center gap-x-6 border-b pb-2 sm:grid ${LEDGER_COLUMNS}`}
            >
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-6 justify-self-end" />
            </div>

            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className={`border-rule grid min-h-[60px] items-center gap-x-6 border-b py-2.5 ${LEDGER_COLUMNS}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="size-11 shrink-0 rounded" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4 sm:hidden" />
                  </div>
                </div>
                <Skeleton className="hidden h-3 w-16 sm:block" />
                <Skeleton className="hidden h-3 w-20 sm:block" />
                <Skeleton className="h-3 w-8 justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
