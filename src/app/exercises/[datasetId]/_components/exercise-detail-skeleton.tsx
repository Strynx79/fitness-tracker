import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the streamed detail body: title, badges, then three stacked cards.
 * The back link and the page shell are already on screen.
 */
export function ExerciseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-8/12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
