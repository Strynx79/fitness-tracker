import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { capitalizeExerciseName } from "@/lib/exercise";
import { cn } from "@/lib/utils";

import { hasActiveFilters, type ExerciseFilters } from "./search-params";

type ExerciseFiltersFormProps = {
  filters: ExerciseFilters;
  bodyParts: string[];
  equipment: string[];
};

/** Matches `Input`'s own classes so a native `<select>` sits level with it. */
const SELECT_CLASSES =
  "h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * Search + facet filters.
 *
 * A plain `method="get"` form on purpose: filtering the catalog works with no
 * JavaScript at all, the URL is the state (so a filtered view is shareable and
 * back/forward behave), and the page itself stays a Server Component. Submitting
 * never posts `page`, which is what sends a new search back to page 1.
 */
export function ExerciseFiltersForm({
  filters,
  bodyParts,
  equipment,
}: ExerciseFiltersFormProps) {
  const filtered = hasActiveFilters(filters);

  return (
    <Card>
      <CardContent>
        <form action="/exercises" method="get" className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="exercise-search">Search</FieldLabel>
            <Input
              id="exercise-search"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Bench press…"
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 text-base"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="exercise-body-part">Body part</FieldLabel>
              <select
                id="exercise-body-part"
                name="bodyPart"
                defaultValue={filters.bodyPart}
                className={SELECT_CLASSES}
              >
                <option value="">All body parts</option>
                {bodyParts.map((bodyPart) => (
                  <option key={bodyPart} value={bodyPart}>
                    {capitalizeExerciseName(bodyPart)}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="exercise-equipment">Equipment</FieldLabel>
              <select
                id="exercise-equipment"
                name="equipment"
                defaultValue={filters.equipment}
                className={SELECT_CLASSES}
              >
                <option value="">All equipment</option>
                {equipment.map((item) => (
                  <option key={item} value={item}>
                    {capitalizeExerciseName(item)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" className="h-12 flex-1 text-base">
              Search
            </Button>
            {filtered ? (
              <Link
                href="/exercises"
                className={cn(buttonVariants({ variant: "outline" }), "h-12 px-4")}
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
