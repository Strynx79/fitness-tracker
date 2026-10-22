"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";

import { deleteExerciseBlock, deleteSet } from "@/app/workouts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WorkoutExerciseBlock, WorkoutSetDto } from "@/lib/workouts";
import {
  formatRpe,
  formatShortDate,
  formatWeight,
} from "@/lib/workout-format";

import { AddSetForm } from "./add-set-form";

type ExerciseBlockProps = {
  block: WorkoutExerciseBlock;
  /** The user's IANA zone, used only to format the history date. */
  timezone: string;
  /** Finished sessions are immutable history; their rows have no actions. */
  canEdit: boolean;
};

/**
 * One exercise card: the table of sets, the number to beat, and the next-set row.
 *
 * The card is driven by `WorkoutExercise`, not by its sets — an exercise the
 * user added but has not logged yet still renders, which is what makes "add it
 * now, fill it in as the workout goes" work.
 */
export function ExerciseBlock({ block, timezone, canEdit }: ExerciseBlockProps) {
  const setLabel = `${block.sets.length} ${block.sets.length === 1 ? "set" : "sets"}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            {block.datasetId === null ? (
              <h2 className="font-heading text-base leading-snug font-medium">
                {block.exerciseName}
              </h2>
            ) : (
              <Link
                href={`/exercises/${block.datasetId}`}
                className="font-heading hover:text-primary inline-flex items-center gap-1 text-base leading-snug font-medium underline-offset-4 hover:underline"
              >
                {block.exerciseName}
                <ExternalLink aria-hidden className="size-3.5 shrink-0 opacity-60" />
              </Link>
            )}
            <CardDescription className="tabular-nums">{setLabel}</CardDescription>
          </div>

          {canEdit ? <DeleteBlockButton block={block} /> : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <PreviousTopSetCallout
          previousTopSet={block.previousTopSet}
          timezone={timezone}
        />

        {block.sets.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-3">
            <p className="text-muted-foreground text-sm">No sets yet.</p>
            {block.exerciseId === null ? null : (
              <Badge variant="outline">Custom</Badge>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-0">#</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead className="text-right">Reps</TableHead>
                <TableHead className="text-right">RPE</TableHead>
                {canEdit ? (
                  <TableHead className="w-12 pr-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.sets.map((set) => (
                <TableRow key={set.id} className="h-12">
                  <TableCell className="text-muted-foreground pl-0 tabular-nums">
                    {set.setNumber}
                  </TableCell>
                  <TableCell className="font-medium">
                    {/* "0 kg" rather than "Bodyweight": keeps the five-column
                        table inside a 320px screen. The callout spells it out. */}
                    {set.weightKg === 0 ? "0 kg" : formatWeight(set.weightKg)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {set.reps}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRpe(set.rpe)}
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="pr-0 text-right">
                      <DeleteSetButton set={set} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {canEdit ? <AddSetForm blockId={block.id} /> : null}
      </CardContent>
    </Card>
  );
}

function PreviousTopSetCallout({
  previousTopSet,
  timezone,
}: {
  previousTopSet: WorkoutExerciseBlock["previousTopSet"];
  timezone: string;
}) {
  if (previousTopSet === null) {
    return (
      <div className="bg-muted/60 rounded-lg px-3 py-2.5">
        <p className="text-sm font-medium">
          No previous session — set a baseline.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-muted/60 flex flex-col gap-0.5 rounded-lg px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium">
        Last time ({formatShortDate(previousTopSet.performedAtIso, timezone)}):
      </p>
      <p className="text-base font-semibold tabular-nums">
        {formatWeight(previousTopSet.weightKg)} × {previousTopSet.reps}
        {previousTopSet.rpe === null ? null : (
          <span className="text-muted-foreground font-normal">
            {" "}
            @ RPE {formatRpe(previousTopSet.rpe)}
          </span>
        )}
      </p>
      <p className="text-muted-foreground text-xs">
        {previousTopSet.sessionName}
      </p>
    </div>
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
            className="text-muted-foreground/60 hover:text-destructive -mr-2 size-11"
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
              {formatWeight(set.weightKg)} × {set.reps}
            </span>{" "}
            from {set.exerciseName}. The remaining sets keep their numbers.
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="lg"
                className="h-11"
                disabled={pending}
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
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
 * Remove an exercise card and every set in it.
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
            className="text-muted-foreground/60 hover:text-destructive -mr-2 size-11 shrink-0"
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
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="lg"
                className="h-11"
                disabled={pending}
              />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
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
