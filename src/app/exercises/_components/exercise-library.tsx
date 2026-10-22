import Link from "next/link";

import { capitalizeExerciseName } from "@/lib/exercise";
import { GYM_VISUAL_ATTRIBUTION, exerciseMediaUrl } from "@/lib/exercise-media";
import { EXERCISES_PAGE_SIZE, getExerciseFacets, searchExercises } from "@/lib/exercises";
import { cn } from "@/lib/utils";

import { ExerciseFiltersForm } from "./exercise-filters-form";
import { ExercisePagination } from "./exercise-pagination";
import { FacetList } from "./facet-list";
import { LEDGER_COLUMNS } from "./ledger";
import { hasActiveFilters, readSearchParam, type ExerciseFilters } from "./search-params";

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
 * Facets are fetched alongside the results rather than inside the rail, because
 * both need the same Suspense boundary — a second boundary would let the counts
 * pop in after the list they describe.
 */
export async function ExerciseLibrary({ searchParams }: ExerciseLibraryProps) {
  const params = await searchParams;

  const filters: ExerciseFilters = {
    q: readSearchParam(params.q),
    // Lowercased here, not just inside the query: the facet values are stored
    // lowercase, so `?bodyPart=Chest` would filter correctly while the rail
    // silently marked "All body parts" as selected (and dropped the filter on
    // the next link click).
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
    getExerciseFacets({
      q: filters.q === "" ? undefined : filters.q,
      bodyPart: filters.bodyPart === "" ? undefined : filters.bodyPart,
      equipment: filters.equipment === "" ? undefined : filters.equipment,
    }),
  ]);

  const { items, total, page, pageCount } = result;
  const firstOnPage = (page - 1) * EXERCISES_PAGE_SIZE + 1;
  const lastOnPage = (page - 1) * EXERCISES_PAGE_SIZE + items.length;

  const range =
    total === 0
      ? "No results"
      : `${firstOnPage}–${lastOnPage} of ${total.toLocaleString("en-US")}`;

  const heading = filters.bodyPart
    ? `${capitalizeExerciseName(filters.bodyPart)} exercises`
    : filters.q !== ""
      ? `Results for “${filters.q}”`
      : "All exercises";

  return (
    <div className="flex flex-col gap-6">
      <ExerciseFiltersForm filters={filters} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <FacetList
            label="Body part"
            param="bodyPart"
            options={facets.bodyParts.options}
            selected={filters.bodyPart}
            total={facets.bodyParts.total}
            filters={filters}
          />
          <FacetList
            label="Equipment"
            param="equipment"
            options={facets.equipment.options}
            selected={filters.equipment}
            total={facets.equipment.total}
            filters={filters}
          />
        </div>

        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-medium">{heading}</h2>
            <p className="text-muted-foreground font-mono text-xs tabular-nums">
              {range}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="bg-card rounded-lg px-6 py-10 text-center">
              <p className="text-sm font-medium">No exercise matches this search.</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-[42ch] text-xs">
                Try a shorter term, or clear the filters to browse the whole
                catalog.
              </p>
              {hasActiveFilters(filters) ? (
                <Link
                  href="/exercises"
                  className="focus-visible:ring-ring/50 mt-4 inline-block rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Clear all filters
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                <div
                  className={cn(
                    "border-rule text-muted-foreground hidden items-center gap-x-6 border-b pb-2 text-xs sm:grid",
                    LEDGER_COLUMNS,
                  )}
                >
                  <span>Exercise</span>
                  <span>Equipment</span>
                  <span>Target</span>
                  <span className="text-right">No.</span>
                </div>

                <ul className="divide-rule divide-y">
                  {items.map((exercise) => {
                    // Resolved once per row: the placeholder slot below keeps
                    // the name on one edge even when a thumbnail is missing.
                    const imageUrl = exerciseMediaUrl(exercise.imagePath);

                    return (
                      <li key={exercise.datasetId}>
                        <Link
                          href={`/exercises/${exercise.datasetId}`}
                          className={cn(
                            "hover:bg-card focus-visible:ring-ring/50 grid min-h-[60px] items-center gap-x-6 py-2.5 transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:outline-none",
                            LEDGER_COLUMNS,
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {imageUrl === null ? (
                              <span
                                className="bg-muted size-11 shrink-0 rounded"
                                aria-hidden
                              />
                            ) : (
                              /*
                                Plain <img>: a 180×180 source rendered at 44px,
                                so the Next image optimizer would add a remote
                                pattern and a resize hop for no visible gain.
                                Hotlinked, not vendored — media © Gym visual.
                              */
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt=""
                                aria-hidden
                                width={44}
                                height={44}
                                loading="lazy"
                                className="bg-muted size-11 shrink-0 rounded object-cover"
                              />
                            )}

                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">
                                {capitalizeExerciseName(exercise.name)}
                              </span>
                              <span className="text-muted-foreground truncate text-[13px] sm:hidden">
                                {capitalizeExerciseName(exercise.equipment)} ·{" "}
                                {capitalizeExerciseName(exercise.target)}
                              </span>
                            </span>
                          </span>

                          <span className="text-muted-foreground hidden truncate text-[13px] sm:block">
                            {capitalizeExerciseName(exercise.equipment)}
                          </span>

                          <span className="text-muted-foreground hidden truncate text-[13px] sm:block">
                            {capitalizeExerciseName(exercise.target)}
                          </span>

                          <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                            <span className="sr-only">Catalog no. </span>
                            {exercise.datasetId}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <ExercisePagination
                filters={filters}
                page={page}
                pageCount={pageCount}
              />

              <p className="text-muted-foreground text-[0.7rem]">
                {GYM_VISUAL_ATTRIBUTION}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
