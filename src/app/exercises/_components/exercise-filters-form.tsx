import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { capitalizeExerciseName } from "@/lib/exercise";
import { cn } from "@/lib/utils";

import { hasActiveFilters, type ExerciseFilters } from "./search-params";

type ExerciseFiltersFormProps = {
  filters: ExerciseFilters;
  bodyParts: string[];
  equipment: string[];
};

/**
 * Search + facet filters.
 *
 * A `method="get"` form on purpose: the URL is the state (shareable, and
 * back/forward behave), and the page itself stays a Server Component. Submitting
 * never posts `page`, which is what sends a new search back to page 1.
 *
 * The facet controls are the custom `SelectField` rather than native `<select>`s:
 * a native popup is drawn by the browser with its own font, which is exactly the
 * mismatch this screen used to have. They need JavaScript to open, so typing in
 * the search box and pressing Enter remains the no-JS path.
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
              <SelectField
                id="exercise-body-part"
                name="bodyPart"
                defaultValue={filters.bodyPart}
                options={[
                  { value: "", label: "All body parts" },
                  ...bodyParts.map((bodyPart) => ({
                    value: bodyPart,
                    label: capitalizeExerciseName(bodyPart),
                  })),
                ]}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="exercise-equipment">Equipment</FieldLabel>
              <SelectField
                id="exercise-equipment"
                name="equipment"
                defaultValue={filters.equipment}
                options={[
                  { value: "", label: "All equipment" },
                  ...equipment.map((item) => ({
                    value: item,
                    label: capitalizeExerciseName(item),
                  })),
                ]}
              />
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
