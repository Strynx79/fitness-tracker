import { Skeleton } from "@/components/ui/skeleton";

/** One label column plus its white panel, matching `SettingsSection`. */
function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="bg-card flex flex-col gap-4 rounded-lg p-5 sm:p-6">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        ))}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors the streamed settings body — header, two form sections and the data
 * section — so the swap-in does not jump. No figures are sketched: a bar that
 * pretends to be a count is a number the user does not have yet.
 */
export function SettingsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>

      <div className="flex flex-col">
        <SectionSkeleton rows={1} />

        <hr className="border-rule my-8 border-t" />

        <SectionSkeleton rows={1} />

        <hr className="border-rule my-8 border-t" />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="bg-card rounded-lg px-5 py-1 sm:px-6">
            <div className="flex h-12 items-center justify-between gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
