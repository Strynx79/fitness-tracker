import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { capitalizeExerciseName } from "@/lib/exercise";
import type { ExerciseFacet } from "@/lib/exercises";
import { cn } from "@/lib/utils";

import { buildExercisesHref, type ExerciseFilters } from "./search-params";

type FacetListProps = {
  /** Sentence-case heading: "Body part" / "Equipment". */
  label: string;
  param: "bodyPart" | "equipment";
  options: ExerciseFacet[];
  /** The active facet value, or `""` for the unfiltered list. */
  selected: string;
  /** Catalog-wide row count, used by the reset item. */
  total: number;
  filters: ExerciseFilters;
};

const ALL_LABEL: Record<FacetListProps["param"], string> = {
  bodyPart: "All body parts",
  equipment: "All equipment",
};

/**
 * The options themselves.
 *
 * One renderer for every placement: wrapped chips below `lg`, full-width ledger
 * rows above it. Below `lg` the list wraps instead of scrolling — a horizontal
 * strip clips a chip at the screen edge and hides the fact that there are more.
 */
function FacetOptions({
  items,
  param,
  selected,
  filters,
  className,
}: {
  items: ExerciseFacet[];
  param: FacetListProps["param"];
  selected: string;
  filters: ExerciseFilters;
  className: string;
}) {
  return (
    <ul className={className}>
      {items.map((option) => {
        const isSelected = selected === option.value;
        const text =
          option.value === ""
            ? ALL_LABEL[param]
            : capitalizeExerciseName(option.value);

        return (
          <li key={option.value === "" ? "__all" : option.value}>
            <Link
              href={buildExercisesHref({ ...filters, [param]: option.value }, 1)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring/50 flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none lg:min-h-0 lg:w-full lg:justify-between lg:py-1 lg:text-sm",
                isSelected
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
              )}
            >
              <span>{text}</span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums lg:ml-auto">
                {option.count.toLocaleString("en-US")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One facet: a wrapping chip set on phones, a ledger rail above `lg`.
 *
 * Links, not controls: the URL is the filter state, so each entry is shareable,
 * works without JavaScript and needs no client component. Every entry links
 * back to page 1 — keeping the old page number after narrowing the result set
 * would land on a clamped (or empty-looking) page.
 *
 * Equipment has 28 values, which is four lines of chips even when wrapped, so
 * below `lg` it folds into a native `<details>`. No client JS, and the summary
 * sits at a 36px tap target. At `lg` the same 28 values are the full rail list;
 * only one variant is visible per width.
 */
export function FacetList({
  label,
  param,
  options,
  selected,
  total,
  filters,
}: FacetListProps) {
  const items: ExerciseFacet[] = [{ value: "", count: total }, ...options];

  if (param === "equipment") {
    return (
      <>
        <details className="group lg:hidden">
          <summary className="text-muted-foreground focus-visible:ring-ring/50 flex h-9 cursor-pointer list-none items-center gap-2 rounded-md text-xs font-medium focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span>{label}</span>
            <span className="font-mono text-xs tabular-nums">
              {options.length.toLocaleString("en-US")}
            </span>
            <ChevronDown
              aria-hidden
              className="ml-auto size-3 transition-transform group-open:rotate-180"
            />
          </summary>

          <FacetOptions
            items={items}
            param={param}
            selected={selected}
            filters={filters}
            className="flex flex-wrap gap-1 pt-2"
          />
        </details>

        <section className="hidden flex-col gap-2 lg:flex">
          <h2 className="text-muted-foreground text-xs font-medium">{label}</h2>
          <FacetOptions
            items={items}
            param={param}
            selected={selected}
            filters={filters}
            className="flex flex-col gap-0"
          />
        </section>
      </>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs font-medium">{label}</h2>
      <FacetOptions
        items={items}
        param={param}
        selected={selected}
        filters={filters}
        className="flex flex-wrap gap-1 lg:flex-col lg:gap-0"
      />
    </section>
  );
}
