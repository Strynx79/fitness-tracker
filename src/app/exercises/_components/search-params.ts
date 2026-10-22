/**
 * Query-string plumbing shared by the library page, its filter form and the
 * pager.
 *
 * `searchParams` values arrive as `string | string[] | undefined` — a repeated
 * `?q=a&q=b` produces an array — so every read is normalized to one trimmed
 * string. Keeping this here (rather than in each component) means the form and
 * the page links agree on what "no filter" looks like: the empty string, which
 * never makes it into a URL.
 */

export type ExerciseFilters = {
  q: string;
  bodyPart: string;
  equipment: string;
};

/** First value of a param, trimmed; arrays take the first entry, never joined. */
export function readSearchParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return "";
}

/**
 * Build a library URL from the active filters.
 *
 * Empty values are omitted so the canonical "everything" URL stays `/exercises`
 * (no `?q=&bodyPart=` noise to break cache keys or bookmark comparisons), and
 * page 1 is omitted for the same reason.
 */
export function buildExercisesHref(filters: ExerciseFilters, page: number): string {
  const params = new URLSearchParams();

  if (filters.q !== "") params.set("q", filters.q);
  if (filters.bodyPart !== "") params.set("bodyPart", filters.bodyPart);
  if (filters.equipment !== "") params.set("equipment", filters.equipment);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query === "" ? "/exercises" : `/exercises?${query}`;
}

/** True when at least one filter is active — drives the "Clear" affordance. */
export function hasActiveFilters(filters: ExerciseFilters): boolean {
  return filters.q !== "" || filters.bodyPart !== "" || filters.equipment !== "";
}
