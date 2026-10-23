"use client";

import { useState, useTransition } from "react";

import { deleteRoutineExercise } from "@/app/routines/actions";
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

type RoutineExerciseRowProps = {
  id: string;
  name: string;
};

/**
 * One exercise's remove control.
 *
 * The action is text in the ledger's fixed trailing column, not an icon: the row
 * already carries the exercise name and its target, and a trash glyph at 13px is
 * harder to hit than a word. No confirmation dialog: nothing has been logged
 * against a routine exercise, so removing it is one tap and one more tap puts it
 * back.
 */
export function RoutineExerciseRow({ id, name }: RoutineExerciseRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);

    startTransition(async () => {
      const result = await deleteRoutineExercise(id);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Dialog>
        <DialogTrigger
          aria-label={`Remove ${name}`}
          render={
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-negative h-11 px-2 text-[13px] font-normal"
            />
          }
        >
          Remove
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {name}?</DialogTitle>
            <DialogDescription>
              This only changes the plan. Sessions you already did are untouched.
            </DialogDescription>
          </DialogHeader>

          {error === null ? null : (
            <p role="alert" className="text-negative text-sm">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost" size="lg" className="h-10" />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              size="lg"
              className="h-10"
              disabled={pending}
              onClick={handleRemove}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error === null ? null : (
        <span
          role="alert"
          className="text-negative max-w-[20ch] text-right text-xs leading-snug"
        >
          {error}
        </span>
      )}
    </div>
  );
}
