"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { discardSession, finishSession } from "@/app/workouts/actions";
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

type SessionActionProps = {
  sessionId: string;
};

/**
 * The session's two terminal actions.
 *
 * Finish is the screen's one filled primary and lives in the header; discard is
 * a quiet text action at the bottom of the page. Both stay behind a
 * confirmation, and errors render inside the modal rather than as a toast: a
 * toast paints behind the dialog popup, where the user cannot read it.
 */
export function FinishSessionButton({ sessionId }: SessionActionProps) {
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
        // completed and the action disappears on its own.
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
          <Button className="h-10 rounded-md px-4 text-sm">
            Finish session
          </Button>
        }
      />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish this session?</DialogTitle>
          <DialogDescription>
            You won&apos;t be able to add sets afterwards. Its top sets become
            the targets for your next workout.
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
            size="lg"
            className="h-10"
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

export function DiscardSessionButton({ sessionId }: SessionActionProps) {
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
            variant="ghost"
            className="text-negative hover:text-negative h-10 rounded-md px-2 text-sm"
          />
        }
      >
        Discard session
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
            onClick={handleDiscard}
          >
            {pending ? "Discarding…" : "Discard session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
