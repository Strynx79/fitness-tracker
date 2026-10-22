import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the streamed filter card and result list so the swap-in does not jump.
 * The page header lives outside the Suspense boundary and is already on screen.
 */
export function ExerciseLibrarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 py-1">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
