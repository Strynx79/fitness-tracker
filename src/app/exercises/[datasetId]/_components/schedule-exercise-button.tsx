"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { scheduleExercise } from "@/app/workouts/actions";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ScheduleExerciseButtonProps = {
  datasetId: string;
  /** Today in the user's timezone — the earliest date that makes sense. */
  today: string;
  /** Tomorrow in the user's timezone; the default pick. */
  defaultDate: string;
};

/**
 * "Schedule" on an exercise detail page.
 *
 * Picking a date creates (or reuses) a workout scheduled for that day and adds
 * this exercise to it, so the day itself starts with the card already there.
 * Auto-naming means this stays a two-tap action — there is no "name your
 * workout" field to fill in.
 */
export function ScheduleExerciseButton({
  datasetId,
  today,
  defaultDate,
}: ScheduleExerciseButtonProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [scheduledSessionId, setScheduledSessionId] = useState<string | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
      // Keep a successful result visible until the dialog is dismissed, then
      // reset so reopening starts from the default date again.
      setScheduledSessionId(null);
      setDate(defaultDate);
    }
  }

  function handleSchedule() {
    setError(null);

    startTransition(async () => {
      const result = await scheduleExercise({ datasetId, date });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setScheduledSessionId(result.sessionId ?? null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="h-12 w-full gap-2 text-base" />
        }
      >
        <CalendarPlus aria-hidden className="size-5" />
        Schedule for later
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule this exercise</DialogTitle>
          <DialogDescription>
            Adds it to a workout on the date you pick, ready to fill in when you
            get there.
          </DialogDescription>
        </DialogHeader>

        {scheduledSessionId === null ? (
          <>
            <Field>
              <FieldLabel htmlFor="schedule-date">Date</FieldLabel>
              <Input
                id="schedule-date"
                type="date"
                value={date}
                min={today}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 text-base"
              />
            </Field>

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
                disabled={pending || date === ""}
                onClick={handleSchedule}
              >
                {pending ? "Scheduling…" : "Schedule"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p role="status" className="text-sm">
              Scheduled. It is waiting in your Upcoming list.
            </p>

            <DialogFooter>
              <DialogClose
                render={<Button variant="ghost" size="lg" className="h-11" />}
              >
                Done
              </DialogClose>
              <Link
                href={`/workouts/${scheduledSessionId}`}
                className={cn(buttonVariants({ size: "lg" }), "h-11")}
              >
                Open workout
              </Link>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
