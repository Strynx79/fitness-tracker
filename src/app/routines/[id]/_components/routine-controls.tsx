"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2 } from "lucide-react";

import {
  deleteRoutine,
  scheduleRoutine,
  setRoutineWeekdays,
} from "@/app/routines/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
 * Toggling a day writes immediately rather than behind a save button: the chips
 * ARE the schedule, and a half-set schedule left unsaved is the kind of state
 * nobody expects from a checkbox row.
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
  const [scheduledSessionId, setScheduledSessionId] = useState<string | null>(null);
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
        // Put the row back the way it was so the chips never claim a schedule
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
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <CardDescription>
          Days this routine is planned for. Leave them all off to start it by
          hand whenever you like.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div
          role="group"
          aria-label="Days of the week"
          className="grid grid-cols-4 gap-2 sm:grid-cols-7"
        >
          {WEEKDAYS.map((day) => {
            const active = days.includes(day.index);

            return (
              <Button
                key={day.index}
                type="button"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                aria-label={day.label}
                disabled={daysPending}
                onClick={() => toggleDay(day.index)}
                className="h-11"
              >
                {day.short}
              </Button>
            );
          })}
        </div>

        {daysError === null ? null : (
          <p role="alert" className="text-destructive text-sm">
            {daysError}
          </p>
        )}

        <div className="flex flex-col gap-2">
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
                  className="h-11 w-full gap-2"
                />
              }
            >
              <CalendarPlus aria-hidden className="size-4" />
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
                      className="h-11 text-base"
                    />
                  </Field>

                  {scheduleError === null ? null : (
                    <p role="alert" className="text-destructive text-sm">
                      {scheduleError}
                    </p>
                  )}

                  <DialogFooter>
                    <DialogClose
                      render={
                        <Button
                          variant="ghost"
                          size="lg"
                          className="h-11"
                          disabled={schedulePending}
                        />
                      }
                    >
                      Cancel
                    </DialogClose>
                    <Button
                      size="lg"
                      className="h-11"
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
                      render={
                        <Button variant="ghost" size="lg" className="h-11" />
                      }
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
                  className="text-destructive hover:text-destructive h-11 w-full gap-2"
                />
              }
            >
              <Trash2 aria-hidden className="size-4" />
              Delete routine
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {routineName}?</DialogTitle>
                <DialogDescription>
                  The plan disappears; workouts you already started from it stay
                  in your history.
                </DialogDescription>
              </DialogHeader>

              {deleteError === null ? null : (
                <p role="alert" className="text-destructive text-sm">
                  {deleteError}
                </p>
              )}

              <DialogFooter>
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="lg"
                      className="h-11"
                      disabled={deletePending}
                    />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-11"
                  disabled={deletePending}
                  onClick={handleDelete}
                >
                  {deletePending ? "Deleting…" : "Delete routine"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
