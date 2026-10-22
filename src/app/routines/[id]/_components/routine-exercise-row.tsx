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

type RoutineExerciseRowProps = {
  id: string;
  name: string;
};

/**
 * One exercise in the plan, with its remove control.
 *
 * No confirmation dialog: nothing has been logged against a routine exercise, so
 * removing it is one tap and one more tap puts it back.
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
    <div className="flex items-center gap-2 border-b py-2 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>

      {error === null ? null : (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      )}

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
    </div>
  );
}
