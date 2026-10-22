import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { buildExercisesHref, type ExerciseFilters } from "./search-params";

type ExercisePaginationProps = {
  filters: ExerciseFilters;
  page: number;
  pageCount: number;
};

/** Classes for the edge case: the arrow stays, but it is not a link. */
const DISABLED_CLASSES =
  "text-muted-foreground/60 pointer-events-none h-11 gap-1 px-3 opacity-50";

/**
 * Prev/next paging for the catalog.
 *
 * Links rather than buttons: each page is a real URL, so opening a result in a
 * new tab or reloading keeps the page, and the whole thing works without
 * JavaScript. The current filters travel with every link, otherwise paging would
 * silently drop a search.
 *
 * Renders nothing when there is only one page — a disabled pair of arrows over
 * "Page 1 of 1" is furniture, not information.
 */
export function ExercisePagination({
  filters,
  page,
  pageCount,
}: ExercisePaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Exercise pages"
      className="flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link
          href={buildExercisesHref(filters, page - 1)}
          rel="prev"
          className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-1 px-3")}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Prev
        </Link>
      ) : (
        <span aria-disabled className={cn(buttonVariants({ variant: "outline" }), DISABLED_CLASSES)}>
          <ChevronLeft aria-hidden className="size-4" />
          Prev
        </span>
      )}

      <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
        Page {page} of {pageCount}
      </p>

      {page < pageCount ? (
        <Link
          href={buildExercisesHref(filters, page + 1)}
          rel="next"
          className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-1 px-3")}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-disabled className={cn(buttonVariants({ variant: "outline" }), DISABLED_CLASSES)}>
          Next
          <ChevronRight aria-hidden className="size-4" />
        </span>
      )}
    </nav>
  );
}
