"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  discardSession,
  finishSession,
} from "@/app/workouts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

type SessionHeaderProps = {
  sessionId: string;
  name: string;
  notes: string | null;
  /** Already formatted server-side in the user's timezone. */
  startedAtLabel: string;
  /** Calendar date label when the workout was planned ahead; `null` if not. */
  scheduledForLabel: string | null;
  completedAtLabel: string | null;
  isCompleted: boolean;
};

/**
 * Session identity plus the two ways to close it.
 *
 * Finish and discard are both terminal, so both sit behind a Dialog. Errors are
 * rendered inside the modal rather than as a toast: a toast paints behind the
 * dialog popup, where the user cannot read it.
 */
export function SessionHeader({
  sessionId,
  name,
  notes,
  startedAtLabel,
  scheduledForLabel,
  completedAtLabel,
  isCompleted,
}: SessionHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-heading text-xl leading-tight font-semibold">
              {name}
            </h1>
            <CardDescription>
              {scheduledForLabel === null ? (
                <span>Started {startedAtLabel}</span>
              ) : (
                <span>Scheduled for {scheduledForLabel}</span>
              )}
              {completedAtLabel === null ? null : (
                <span> · Finished {completedAtLabel}</span>
              )}
            </CardDescription>
          </div>
          <Badge variant={isCompleted ? "secondary" : "default"}>
            {isCompleted ? "Completed" : "In progress"}
          </Badge>
        </div>
      </CardHeader>

      {notes === null ? null : (
        <CardContent>
          <p className="text-sm whitespace-pre-line">{notes}</p>
        </CardContent>
      )}

      {isCompleted ? null : (
        <CardFooter className="flex-col gap-2 sm:flex-row">
          <FinishSessionButton sessionId={sessionId} />
          <DiscardSessionButton sessionId={sessionId} />
        </CardFooter>
      )}
    </Card>
  );
}

function FinishSessionButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setError(null);
  }

  function handleFinish() {
    startTransition(async () => {
      const result = await finishSession(sessionId);

      if (result.ok) {
        // `finishSession` revalidates this route, so the header re-renders as
        // completed and the action buttons disappear on their own.
        setOpen(false);
        return;
      }

      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="lg" className="h-11 w-full sm:flex-1" />
        }
      >
        Finish session
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish this session?</DialogTitle>
          <DialogDescription>
            You won&apos;t be able to add sets afterwards. Its top sets become
            the targets for your next workout.
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
            size="lg"
            className="h-11"
            disabled={pending}
            onClick={handleFinish}
          >
            {pending ? "Finishing…" : "Finish session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscardSessionButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setError(null);
  }

  function handleDiscard() {
    startTransition(async () => {
      const result = await discardSession(sessionId);

      if (result.ok) {
        setOpen(false);
        router.push("/workouts");
        return;
      }

      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="text-destructive h-11 w-full sm:flex-1"
          />
        }
      >
        Discard
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard this session?</DialogTitle>
          <DialogDescription>
            The session and every set in it are deleted. This can&apos;t be
            undone.
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
            onClick={handleDiscard}
          >
            {pending ? "Discarding…" : "Discard session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
