"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteRoutine,
  scheduleRoutine,
  setRoutineWeekdays,
} from "@/app/routines/actions";
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
import { WEEKDAYS } from "@/lib/weekdays";
import { cn } from "@/lib/utils";

type RoutineControlsProps = {
  routineId: string;
  routineName: string;
  weekdays: number[];
  /** Today in the user's timezone — earliest schedulable date. */
  today: string;
  /** Tomorrow in the user's timezone; the default pick. */
  defaultDate: string;
};

/**
 * Weekly schedule + scheduling a run of the routine.
 *
 * Toggling a day writes immediately rather than behind a save button: the day
 * buttons ARE the schedule, and a half-set schedule left unsaved is the kind of
 * state nobody expects from a checkbox row. Selected days step to `bg-muted`,
 * not to the primary fill — "Start workout" is this screen's one filled action.
 */
export function RoutineControls({
  routineId,
  routineName,
  weekdays,
  today,
  defaultDate,
}: RoutineControlsProps) {
  const router = useRouter();

  const [days, setDays] = useState<number[]>(weekdays);
  const [daysPending, startDaysTransition] = useTransition();
  const [daysError, setDaysError] = useState<string | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduledSessionId, setScheduledSessionId] = useState<string | null>(
    null,
  );
  const [schedulePending, startScheduleTransition] = useTransition();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function toggleDay(index: number) {
    const next = days.includes(index)
      ? days.filter((day) => day !== index)
      : [...days, index];

    const previous = days;
    setDays(next);
    setDaysError(null);

    startDaysTransition(async () => {
      const result = await setRoutineWeekdays(routineId, next);

      if (!result.ok) {
        // Put the row back the way it was so the buttons never claim a schedule
        // the database rejected.
        setDays(previous);
        setDaysError(result.message);
      }
    });
  }

  function handleSchedule() {
    setScheduleError(null);

    startScheduleTransition(async () => {
      const result = await scheduleRoutine(routineId, date);

      if (!result.ok) {
        setScheduleError(result.message);
        return;
      }

      setScheduledSessionId(result.sessionId ?? null);
    });
  }

  function handleDelete() {
    setDeleteError(null);

    startDeleteTransition(async () => {
      const result = await deleteRoutine(routineId);

      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }

      setDeleteOpen(false);
      router.push("/routines");
    });
  }

  return (
    <section
      aria-labelledby="routine-schedule-heading"
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="routine-schedule-heading"
          className="text-base leading-snug font-medium"
        >
          Schedule
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {days.length === 0
            ? "None"
            : `${days.length} day${days.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
        Days this routine is planned for. Leave them all off to start it by hand
        whenever you like.
      </p>

      <div
        role="group"
        aria-label="Days of the week"
        className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7"
      >
        {WEEKDAYS.map((day) => {
          const active = days.includes(day.index);

          return (
            <button
              key={day.index}
              type="button"
              aria-pressed={active}
              aria-label={day.label}
              disabled={daysPending}
              onClick={() => toggleDay(day.index)}
              className={cn(
                "focus-visible:ring-ring/50 h-11 rounded-md border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
                active
                  ? "border-input bg-muted text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {day.short}
            </button>
          );
        })}
      </div>

      {daysError === null ? null : (
        <p role="alert" className="text-negative mt-3 text-[13px]">
          {daysError}
        </p>
      )}

      <div className="border-rule mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <Dialog
          open={scheduleOpen}
          onOpenChange={(next) => {
            setScheduleOpen(next);
            if (!next) {
              setScheduleError(null);
              setScheduledSessionId(null);
              setDate(defaultDate);
            }
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="outline"
                className="bg-card h-10 rounded-md px-4 text-sm"
              />
            }
          >
            Schedule a day
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule {routineName}</DialogTitle>
              <DialogDescription>
                Creates a workout on that date with these exercises already in
                it.
              </DialogDescription>
            </DialogHeader>

            {scheduledSessionId === null ? (
              <>
                <Field>
                  <FieldLabel htmlFor="routine-schedule-date">Date</FieldLabel>
                  <Input
                    id="routine-schedule-date"
                    type="date"
                    value={date}
                    min={today}
                    onChange={(event) => setDate(event.target.value)}
                    className="bg-card h-10 rounded-md px-3 text-sm"
                  />
                </Field>

                {scheduleError === null ? null : (
                  <p role="alert" className="text-negative text-sm">
                    {scheduleError}
                  </p>
                )}

                <DialogFooter>
                  <DialogClose
                    render={
                      <Button
                        variant="ghost"
                        className="h-10"
                        disabled={schedulePending}
                      />
                    }
                  >
                    Cancel
                  </DialogClose>
                  <Button
                    className="h-10"
                    disabled={schedulePending || date === ""}
                    onClick={handleSchedule}
                  >
                    {schedulePending ? "Scheduling…" : "Schedule"}
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
                    render={<Button variant="ghost" className="h-10" />}
                  >
                    Done
                  </DialogClose>
                  <Link
                    href={`/workouts/${scheduledSessionId}`}
                    className={cn(buttonVariants(), "h-10")}
                  >
                    Open workout
                  </Link>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={deleteOpen}
          onOpenChange={(next) => {
            setDeleteOpen(next);
            if (!next) setDeleteError(null);
          }}
        >
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-negative h-10 px-2 text-[13px] font-normal"
              />
            }
          >
            Delete routine
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {routineName}?</DialogTitle>
              <DialogDescription>
                The plan disappears; workouts you already started from it stay in
                your history.
              </DialogDescription>
            </DialogHeader>

            {deleteError === null ? null : (
              <p role="alert" className="text-negative text-sm">
                {deleteError}
              </p>
            )}

            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    className="h-10"
                    disabled={deletePending}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                className="h-10"
                disabled={deletePending}
                onClick={handleDelete}
              >
                {deletePending ? "Deleting…" : "Delete routine"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
