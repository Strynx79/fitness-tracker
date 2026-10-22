"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";

import { addExerciseBlock, searchCatalog } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { capitalizeExerciseName } from "@/lib/exercise";
import type { ExerciseSummary } from "@/lib/exercises";

type AddExerciseButtonProps = {
  sessionId: string;
};

/** Long enough to skip a keystroke, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The "+ Add exercise" control and its search sheet.
 *
 * One dialog serves both entry points the user asked for: type "chest press" and
 * pick the variant you meant, or type a name that is not in the catalog and add
 * it as a custom card. The sheet is a "which one did you mean" list (top 8), not
 * a browser — browsing lives in the library tab.
 *
 * The search runs through a Server Action so it reuses the exact catalog query
 * (ordering, pagination, LIKE-escaping) instead of shipping the dataset to the
 * client.
 */
export function AddExerciseButton({ sessionId }: AddExerciseButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Debounced search. `cancelled` stops a slow response for "che" from landing
  // after the faster one for "chest". Nothing is set synchronously in the effect
  // body: an empty query simply stops the timer, and the render below hides any
  // stale results.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") return;

    let cancelled = false;

    const timer = setTimeout(() => {
      setSearching(true);

      void searchCatalog(trimmed)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function reset() {
    setQuery("");
    setResults([]);
    setCustomName("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function add(input: { datasetId?: string; name?: string }) {
    setError(null);

    startTransition(async () => {
      const result = await addExerciseBlock({ sessionId, ...input });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setOpen(false);
      reset();
      // The block list is a Server Component; refresh re-renders the session
      // with the new card (and its empty table) in place.
      router.refresh();
    });
  }

  const trimmedQuery = query.trim();
  const trimmedCustom = customName.trim();
  // A cleared query hides whatever the last search returned without needing an
  // effect to reset state (which would cascade renders).
  const visibleResults = trimmedQuery === "" ? [] : results;
  const showSearching = trimmedQuery !== "" && searching;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" className="h-12 w-full gap-2 text-base" />}
      >
        <Plus aria-hidden className="size-5" />
        Add exercise
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an exercise</DialogTitle>
          <DialogDescription>
            Search the library, or add a custom exercise that is not in it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chest press, squat, row…"
              aria-label="Search exercises"
              autoComplete="off"
              className="h-11 pl-9 text-base"
            />
          </div>

          {showSearching ? (
            <p className="text-muted-foreground flex items-center gap-2 px-1 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Searching…
            </p>
          ) : null}

          {!showSearching && trimmedQuery !== "" && visibleResults.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">
              Nothing in the library matches “{trimmedQuery}”. Add it as a custom
              exercise below.
            </p>
          ) : null}

          {visibleResults.length > 0 ? (
            <ul className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
              {visibleResults.map((exercise) => (
                <li key={exercise.datasetId}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add({ datasetId: exercise.datasetId })}
                    className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-14 w-full flex-col items-start justify-center gap-0.5 rounded-lg px-2 py-2 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:opacity-50"
                  >
                    <span className="text-sm font-medium">
                      {capitalizeExerciseName(exercise.name)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {capitalizeExerciseName(exercise.equipment)} ·{" "}
                      {capitalizeExerciseName(exercise.target)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <Separator />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="custom-exercise-name"
              className="text-sm font-medium"
            >
              Custom exercise
            </label>
            <div className="flex gap-2">
              <Input
                id="custom-exercise-name"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="e.g. Sled push"
                autoComplete="off"
                className="h-11 flex-1 text-base"
              />
              <Button
                type="button"
                className="h-11 shrink-0"
                disabled={pending || trimmedCustom === ""}
                onClick={() => add({ name: trimmedCustom })}
              >
                Add
              </Button>
            </div>
          </div>

          {error === null ? null : (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
