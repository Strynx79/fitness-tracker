import Link from "next/link";
import { Search } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { hasActiveFilters, type ExerciseFilters } from "./search-params";

type ExerciseFiltersFormProps = {
  filters: ExerciseFilters;
};

/**
 * Search only — the facet rail owns body part and equipment.
 *
 * A `method="get"` form on purpose: the URL is the state (shareable, and
 * back/forward behave) and the page stays a Server Component. Submitting never
 * posts `page`, which is what sends a new search back to page 1.
 *
 * The active facets travel as hidden fields (only when set, so the canonical
 * "/exercises" URL stays clean): without them a GET submit would rebuild the
 * query string from the search box alone and silently drop the body part or
 * equipment the user had just clicked.
 */
export function ExerciseFiltersForm({ filters }: ExerciseFiltersFormProps) {
  const filtered = hasActiveFilters(filters);

  return (
    <form
      action="/exercises"
      method="get"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="relative min-w-0 sm:flex-1">
        <label htmlFor="exercise-search" className="sr-only">
          Search exercises
        </label>
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          id="exercise-search"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Bench press, squat, cable fly…"
          autoComplete="off"
          enterKeyHint="search"
          className="bg-card h-9 rounded-md pl-9 text-sm"
        />
      </div>

      {filters.bodyPart === "" ? null : (
        <input type="hidden" name="bodyPart" value={filters.bodyPart} />
      )}
      {filters.equipment === "" ? null : (
        <input type="hidden" name="equipment" value={filters.equipment} />
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" className="h-9 flex-1 rounded-md px-4 sm:flex-none">
          Search
        </Button>
        {filtered ? (
          <Link
            href="/exercises"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-input bg-card h-9 rounded-md px-3",
            )}
          >
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
