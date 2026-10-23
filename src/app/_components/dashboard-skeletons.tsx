import { Skeleton } from "@/components/ui/skeleton";

/**
 * The four dashboard fallbacks.
 *
 * Each one mirrors the block's *empty* state — the frame, the 20/24px padding,
 * the heading line, one sentence and the 44px link row. That is the shape a
 * fresh account actually resolves to, and it is also the shape every block
 * keeps when its query returns nothing, so the swap-in does not move the page.
 * No figures are sketched: a bar that pretends to be a weight is a number the
 * user does not have.
 */

function SkeletonPanel({
  headingWidth,
  sentenceWidth,
  actionWidth,
}: {
  headingWidth: string;
  sentenceWidth: string;
  actionWidth: string;
}) {
  return (
    <div aria-hidden className="bg-card rounded-lg p-5 sm:p-6">
      <Skeleton className={`h-5 ${headingWidth}`} />

      <div className="mt-3.5">
        <Skeleton className={`h-4 ${sentenceWidth} max-w-full`} />

        {/* The link's 44px row, without painting a block the size of a button. */}
        <div className="mt-1.5 flex h-11 items-center">
          <Skeleton className={`h-4 ${actionWidth}`} />
        </div>
      </div>
    </div>
  );
}

export function TodayPlanSkeleton() {
  return (
    <SkeletonPanel
      headingWidth="w-32"
      sentenceWidth="w-40"
      actionWidth="w-28"
    />
  );
}

export function WeightCardSkeleton() {
  return (
    <SkeletonPanel
      headingWidth="w-16"
      sentenceWidth="w-28"
      actionWidth="w-24"
    />
  );
}

export function HabitsCardSkeleton() {
  return (
    <SkeletonPanel
      headingWidth="w-32"
      sentenceWidth="w-24"
      actionWidth="w-20"
    />
  );
}

export function LastWorkoutSkeleton() {
  return (
    <SkeletonPanel
      headingWidth="w-28"
      sentenceWidth="w-28"
      actionWidth="w-28"
    />
  );
}
