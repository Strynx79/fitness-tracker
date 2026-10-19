"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteSet } from "@/app/workouts/actions";
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
import type { WorkoutExerciseGroup, WorkoutSetDto } from "@/lib/workouts";
import {
  formatRpe,
  formatShortDate,
  formatWeight,
} from "@/lib/workout-format";

type ExerciseGroupProps = {
  group: WorkoutExerciseGroup;
  /** The user's IANA zone, used only to format the history date. */
  timezone: string;
  /** Finished sessions are immutable history; their rows have no delete action. */
  canDelete: boolean;
};

/**
 * One exercise, its sets, and the number to beat.
 *
 * The callout is the point of the slice: `previousTopSet` is resolved on the
 * server from the most recent COMPLETED session (never the in-progress one this
 * screen is logging into, and never an older session), so nothing here has to
 * guess at history.
 */
export function ExerciseGroup({
  group,
  timezone,
  canDelete,
}: ExerciseGroupProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-base leading-snug font-medium">
            {group.exerciseName}
          </h2>
          <CardDescription className="tabular-nums">
            {group.sets.length} {group.sets.length === 1 ? "set" : "sets"}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <PreviousTopSetCallout
          previousTopSet={group.previousTopSet}
          timezone={timezone}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-0">#</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead className="text-right">Reps</TableHead>
              <TableHead className="text-right">RPE</TableHead>
              {canDelete ? (
                <TableHead className="w-12 pr-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.sets.map((set) => (
              <TableRow key={set.id} className="h-12">
                <TableCell className="text-muted-foreground pl-0 tabular-nums">
                  {set.setNumber}
                </TableCell>
                <TableCell className="font-medium">
                  {/* "0 kg" rather than "Bodyweight": keeps the 5-column
                      table inside a 320px screen without horizontal scroll.
                      The callout above spells it out in full. */}
                  {set.weightKg === 0 ? "0 kg" : formatWeight(set.weightKg)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {set.reps}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRpe(set.rpe)}
                </TableCell>
                {canDelete ? (
                  <TableCell className="pr-0 text-right">
                    <DeleteSetButton set={set} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PreviousTopSetCallout({
  previousTopSet,
  timezone,
}: {
  previousTopSet: WorkoutExerciseGroup["previousTopSet"];
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
 * keep their original numbers, which is why the dialog says so instead of
 * implying the list renumbers.
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
        // `deleteSet` revalidates the session path, so the row disappears.
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
