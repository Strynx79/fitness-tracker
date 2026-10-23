import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the streamed content's header, sheet and form so the swap-in doesn't
 * jump. Everything downstream of the Suspense boundary waits on a DB read, so
 * this is what the user sees first.
 *
 * The sheet keeps its 48px row rhythm and the form keeps its panel padding;
 * no figures are sketched, because a bar pretending to be a count is a number
 * the user does not have.
 */
export function HabitsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-5 w-44 max-w-full" />
      </div>

      <div className="bg-card overflow-hidden rounded-lg">
        <div className="px-5 pt-4 pb-3 sm:px-6">
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="border-rule divide-rule divide-y border-t">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex min-h-12 items-center pr-2 pl-2">
              <div className="flex w-11 shrink-0 justify-center self-stretch">
                <Skeleton className="size-5 rounded" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-28 max-w-full" />
              </div>

              <Skeleton className="ml-3 h-4 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg p-5 sm:p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          <div className="flex justify-end">
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
