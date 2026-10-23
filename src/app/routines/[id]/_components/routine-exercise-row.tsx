"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

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

type RemoveRoutineExerciseButtonProps = {
  id: string;
  name: string;
};

/**
 * The remove control for one exercise in a routine.
 *
 * Deliberately ONLY the button and its dialog: the row itself (name, link,
 * divider) belongs to the page. Rendering the label here as well is what made
 * two exercises overlap on a phone — two `flex-1` siblings each holding the same
 * string.
 */
export function RemoveRoutineExerciseButton({
  id,
  name,
}: RemoveRoutineExerciseButtonProps) {
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
    <Dialog>
      <DialogTrigger
        aria-label={`Remove ${name}`}
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/60 hover:text-destructive size-11 shrink-0"
          />
        }
      >
        <Trash2 aria-hidden />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription>
            This only changes the plan. Sessions you already did are untouched.
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={<Button variant="ghost" size="lg" className="h-11" />}
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
            disabled={pending}
            onClick={handleRemove}
          >
            {pending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
