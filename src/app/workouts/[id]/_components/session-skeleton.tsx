import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the session header, log form and exercise cards so the swap-in does
 * not jump. `params` and the two DB reads stream behind this.
 */
export function SessionSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardContent>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-11 w-full sm:flex-1" />
          <Skeleton className="h-11 w-full sm:flex-1" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>

      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
