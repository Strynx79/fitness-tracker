import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { capitalizeExerciseName } from "@/lib/exercise";
import { EXERCISES_PAGE_SIZE, getExerciseFacets, searchExercises } from "@/lib/exercises";

import { ExerciseFiltersForm } from "./exercise-filters-form";
import { ExercisePagination } from "./exercise-pagination";
import { readSearchParam, type ExerciseFilters } from "./search-params";

type ExerciseLibraryProps = {
  /** The raw promise from the page; awaited here, inside Suspense. */
  searchParams: PageProps<"/exercises">["searchParams"];
};

/** `"..."` → a number, or `undefined` so the query applies its own default. */
function readPage(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The streamed half of the library page.
 *
 * Everything request-shaped lives here: awaiting `searchParams`, the catalog
 * query and the facet lists. The static header stays outside the boundary, so
 * the page still prerenders under Cache Components while the results stream.
 *
 * Facets are fetched alongside the results rather than inside the filter card,
 * because both need the same Suspense boundary — a second boundary would let the
 * selects pop in after the list.
 */
export async function ExerciseLibrary({ searchParams }: ExerciseLibraryProps) {
  const params = await searchParams;

  const filters: ExerciseFilters = {
    q: readSearchParam(params.q),
    // Lowercased here, not just inside the query: the facet options are stored
    // lowercase, so `?bodyPart=Chest` would filter correctly while the <select>
    // silently showed "All body parts" (and dropping the filter on next submit).
    bodyPart: readSearchParam(params.bodyPart).toLowerCase(),
    equipment: readSearchParam(params.equipment).toLowerCase(),
  };

  const [result, facets] = await Promise.all([
    searchExercises({
      q: filters.q === "" ? undefined : filters.q,
      bodyPart: filters.bodyPart === "" ? undefined : filters.bodyPart,
      equipment: filters.equipment === "" ? undefined : filters.equipment,
      page: readPage(readSearchParam(params.page)),
    }),
    getExerciseFacets(),
  ]);

  const { items, total, page, pageCount } = result;
  const firstOnPage = (page - 1) * EXERCISES_PAGE_SIZE + 1;
  const lastOnPage = (page - 1) * EXERCISES_PAGE_SIZE + items.length;

  return (
    <div className="flex flex-col gap-4">
      <ExerciseFiltersForm
        filters={filters}
        bodyParts={facets.bodyParts}
        equipment={facets.equipment}
      />

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {total === 0
              ? "Nothing matches these filters."
              : pageCount > 1
                ? `Showing ${firstOnPage}–${lastOnPage} of ${total} exercises.`
                : `${total} ${total === 1 ? "exercise" : "exercises"}.`}
          </CardDescription>
        </CardHeader>

        {items.length === 0 ? (
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm font-medium">No exercises match</p>
              <p className="text-muted-foreground max-w-[32ch] text-xs">
                Try a shorter search term, or clear the equipment and body-part
                filters.
              </p>
              <Link
                href="/exercises"
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          </CardContent>
        ) : (
          <ul className="divide-y border-t">
            {items.map((exercise) => (
              <li key={exercise.datasetId}>
                <Link
                  href={`/exercises/${exercise.datasetId}`}
                  className="hover:bg-muted/50 focus-visible:ring-ring/50 flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors focus-visible:ring-3 focus-visible:outline-none"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {capitalizeExerciseName(exercise.name)}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {capitalizeExerciseName(exercise.equipment)} ·{" "}
                      {capitalizeExerciseName(exercise.target)}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">
                      {capitalizeExerciseName(exercise.bodyPart)}
                    </Badge>
                    <ChevronRight
                      aria-hidden
                      className="text-muted-foreground size-4"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ExercisePagination filters={filters} page={page} pageCount={pageCount} />
    </div>
  );
}
