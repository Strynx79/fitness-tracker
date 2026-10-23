"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { deleteExerciseBlock, deleteSet } from "@/app/workouts/actions";
import { formatKgDecimal } from "@/app/workouts/_components/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WorkoutExerciseBlock, WorkoutSetDto } from "@/lib/workouts";
import { formatRpe, formatShortDate } from "@/lib/workout-format";

import { AddSetForm } from "./add-set-form";

type ExerciseBlockProps = {
  block: WorkoutExerciseBlock;
  /** The user's IANA zone, used only to format the history date. */
  timezone: string;
  /** Finished sessions are immutable history; their rows have no actions. */
  canEdit: boolean;
};

/**
 * One exercise panel: the ruled set list, the number to beat, and the next-set
 * row.
 *
 * The panel is driven by `WorkoutExercise`, not by its sets — an exercise the
 * user added but has not logged yet still renders, which is what makes "add it
 * now, fill it in as the workout goes" work. A blank panel keeps its heading
 * and puts the form directly under one honest sentence.
 */
export function ExerciseBlock({ block, timezone, canEdit }: ExerciseBlockProps) {
  const setLabel = `${block.sets.length} ${block.sets.length === 1 ? "set" : "sets"}`;

  return (
    <section
      aria-labelledby={`exercise-block-${block.id}`}
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`exercise-block-${block.id}`}
            className="text-base leading-snug font-medium"
          >
            {block.datasetId === null ? (
              block.exerciseName
            ) : (
              <Link
                href={`/exercises/${block.datasetId}`}
                className="focus-visible:ring-ring/50 rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {block.exerciseName}
              </Link>
            )}
          </h2>

          <PreviousTopSetLine
            previousTopSet={block.previousTopSet}
            timezone={timezone}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <p className="text-muted-foreground text-xs tabular-nums">
            {setLabel}
          </p>
          {canEdit ? <DeleteBlockButton block={block} /> : null}
        </div>
      </div>

      {block.sets.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">No sets logged yet.</p>
      ) : (
        <table className="mt-3 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-rule text-muted-foreground border-b text-xs">
              <th scope="col" className="w-12 py-2 pr-4 text-left font-normal">
                Set
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-normal">
                Weight
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-normal">
                Reps
              </th>
              {canEdit ? (
                <th scope="col" className="w-11 py-2 pl-2">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody className="divide-rule divide-y">
            {block.sets.map((set) => (
              <tr key={set.id} className="h-12">
                <td className="text-muted-foreground pr-4 font-mono text-xs tabular-nums">
                  {set.setNumber}
                </td>
                <td className="pl-4 text-right font-mono tabular-nums">
                  <span className="sr-only">Weight </span>
                  {formatKgDecimal(set.weightKg)}
                  <span className="sr-only"> kilograms</span>
                </td>
                <td className="pl-4 text-right font-mono tabular-nums">
                  {set.reps}
                  <span className="sr-only"> reps</span>
                </td>
                {canEdit ? (
                  <td className="pl-2 text-right">
                    <DeleteSetButton set={set} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEdit ? (
        <div className="mt-3">
          <AddSetForm blockId={block.id} />
        </div>
      ) : null}
    </section>
  );
}

function PreviousTopSetLine({
  previousTopSet,
  timezone,
}: {
  previousTopSet: WorkoutExerciseBlock["previousTopSet"];
  timezone: string;
}) {
  if (previousTopSet === null) {
    return (
      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
        No previous session — set a baseline.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
      Last time ({formatShortDate(previousTopSet.performedAtIso, timezone)}):{" "}
      {previousTopSet.weightKg === 0 ? (
        <span className="text-foreground">Bodyweight × </span>
      ) : (
        <span className="text-foreground font-mono tabular-nums">
          {formatKgDecimal(previousTopSet.weightKg)} kg ×{" "}
        </span>
      )}
      <span className="text-foreground font-mono tabular-nums">
        {previousTopSet.reps}
      </span>
      {previousTopSet.rpe === null ? null : (
        <>
          {" "}
          <span className="font-mono tabular-nums">
            @ RPE {formatRpe(previousTopSet.rpe)}
          </span>
        </>
      )}
    </p>
  );
}

/**
 * Remove one set, behind a confirmation.
 *
 * The action refuses finished sessions and recomputes nothing: remaining sets
 * keep their original numbers, which is why the dialog says so.
 */
function DeleteSetButton({ set }: { set: WorkoutSetDto }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setError(null);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSet(set.id);

      if (result.ok) {
        setOpen(false);
        return;
      }

      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        aria-label={`Delete set ${set.setNumber} of ${set.exerciseName}`}
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-negative -mr-2 size-11 rounded-md"
          />
        }
      >
        <Trash2 aria-hidden />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete set {set.setNumber}?</DialogTitle>
          <DialogDescription>
            This removes{" "}
            <span className="text-foreground font-medium tabular-nums">
              {set.weightKg === 0
                ? "Bodyweight"
                : `${formatKgDecimal(set.weightKg)} kg`}{" "}
              × {set.reps}
            </span>{" "}
            from {set.exerciseName}. The remaining sets keep their numbers.
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-negative text-[13px]">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="lg"
                className="h-10"
                disabled={pending}
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            className="h-10"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Delete set"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Remove an exercise panel and every set in it.
 *
 * The count is in the copy on purpose: this is the one action on the screen that
 * can delete more than the row you tapped.
 */
function DeleteBlockButton({ block }: { block: WorkoutExerciseBlock }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setCount = block.sets.length;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setError(null);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExerciseBlock(block.id);

      if (result.ok) {
        setOpen(false);
        return;
      }

      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        aria-label={`Remove ${block.exerciseName}`}
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-negative -mr-2 size-11 shrink-0 rounded-md"
          />
        }
      >
        <Trash2 aria-hidden />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {block.exerciseName}?</DialogTitle>
          <DialogDescription>
            {setCount === 0
              ? "This exercise has no sets logged."
              : `This also deletes ${setCount} ${setCount === 1 ? "set" : "sets"} logged for it in this workout.`}
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-negative text-[13px]">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="lg"
                className="h-10"
                disabled={pending}
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            className="h-10"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Removing…" : "Remove exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
