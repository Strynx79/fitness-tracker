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

/** The edge case: the label stays, but it is not a link. */
const EDGE_CLASSES =
  "text-muted-foreground pointer-events-none h-9 rounded-md px-3 opacity-50";

/**
 * Prev/next paging for the catalog.
 *
 * Links rather than buttons: each page is a real URL, so opening a result in a
 * new tab or reloading keeps the page, and the whole thing works without
 * JavaScript. The current filters travel with every link, otherwise paging would
 * silently drop a search.
 *
 * Renders nothing when there is only one page — a disabled pair of arrows over
 * "Page 1 of 1" is furniture, not information. The result range lives in the
 * results header, so it is not repeated here.
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
      className="border-rule flex items-center justify-between gap-3 border-t pt-4"
    >
      {page > 1 ? (
        <Link
          href={buildExercisesHref(filters, page - 1)}
          rel="prev"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "border-input bg-card h-9 gap-1 rounded-md px-3 text-sm",
          )}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Prev
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(
            buttonVariants({ variant: "outline" }),
            "border-input bg-card",
            EDGE_CLASSES,
          )}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Prev
        </span>
      )}

      <p
        className="text-muted-foreground font-mono text-xs tabular-nums"
        aria-live="polite"
      >
        Page {page} of {pageCount}
      </p>

      {page < pageCount ? (
        <Link
          href={buildExercisesHref(filters, page + 1)}
          rel="next"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "border-input bg-card h-9 gap-1 rounded-md px-3 text-sm",
          )}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(
            buttonVariants({ variant: "outline" }),
            "border-input bg-card",
            EDGE_CLASSES,
          )}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </span>
      )}
    </nav>
  );
}
