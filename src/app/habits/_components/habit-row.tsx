"use client";

import { useState, useTransition } from "react";
import { Archive, Flame } from "lucide-react";
import { toast } from "sonner";

import { archiveHabit } from "@/app/habits/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { parseIsoDate } from "@/lib/date";
import type { HabitWithStats } from "@/lib/habits";
import { cn } from "@/lib/utils";

type HabitRowProps = {
  habit: HabitWithStats;
  /**
   * The value to render, which is the optimistic one while a tap is in flight.
   * The parent owns it so every row's checkbox moves on the same tick.
   */
  checked: boolean;
  onToggle: (habitId: string, completed: boolean) => void;
};

/** "Oct 15" for the dot tooltips. UTC for the same reason as the page header. */
const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function HabitRow({ habit, checked, onToggle }: HabitRowProps) {
  const checkboxId = `habit-check-${habit.id}`;

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      {/*
        `id` here is what Base UI puts on the hidden <input>, so the <label>
        below toggles it natively — the whole name/description block is a tap
        target, not just the 20px box. The checkbox's own `after:-inset-*`
        padding widens the touch area further.
      */}
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(next) => onToggle(habit.id, next)}
        className="mt-1 size-5"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer flex-col gap-0.5"
        >
          <span
            className={cn(
              "text-base leading-snug font-medium",
              checked && "text-muted-foreground line-through",
            )}
          >
            {habit.name}
          </span>
          {habit.description === null ? null : (
            <span className="text-muted-foreground text-sm leading-snug">
              {habit.description}
            </span>
          )}
        </label>

        <HabitStats habit={habit} />
      </div>

      <ArchiveHabitButton habit={habit} />
    </li>
  );
}

/**
 * Streak and 7-day completion.
 *
 * The pixels are `aria-hidden` and summarised once in prose below them: read
 * literally the strip is "12 100% ○●○●●●", which is noise for a screen reader,
 * and the sr-only line bundles the paired facts (dot dates included) without
 * the row announcing them twice.
 */
function HabitStats({ habit }: { habit: HabitWithStats }) {
  const hasStreak = habit.streak > 0;
  const streakLabel = habit.streakCapped ? "365+" : String(habit.streak);
  const todayIndex = habit.last7Days.length - 1;

  const summary = [
    hasStreak ? `${streakLabel} day streak` : "No current streak",
    `${habit.completionRate7d}% of the last 7 days`,
  ].join(", ");

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex items-center gap-3 text-xs">
        {/*
          A zero streak is greyed rather than celebrated: an orange flame next
          to "0" reads as a trophy for having done nothing.
        */}
        <span
          className={cn(
            "inline-flex items-center gap-1",
            hasStreak ? "font-medium" : "text-muted-foreground/60",
          )}
        >
          <Flame className={cn("size-3.5", hasStreak && "text-amber-500")} />
          <span className="tabular-nums">{streakLabel}</span>
        </span>

        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="tabular-nums">{habit.completionRate7d}%</span>
          <span className="flex items-center gap-0.5">
            {habit.last7Days.map((day, index) => (
              <span
                key={day.date}
                title={`${DAY_LABEL.format(parseIsoDate(day.date))}${
                  index === todayIndex ? " (today)" : ""
                } — ${day.completed ? "completed" : "not completed"}`}
                className={cn(
                  "size-2 rounded-full",
                  day.completed
                    ? "bg-primary"
                    : "border border-muted-foreground/40",
                  index === todayIndex && "ring-2 ring-primary/25",
                )}
              />
            ))}
          </span>
        </span>
      </span>

      <span className="sr-only">{summary}</span>
    </div>
  );
}

/**
 * Soft delete, behind a confirmation.
 *
 * Deliberately the trailing element of the row with its own 44px target: the
 * checkbox sits at the leading edge and the label fills everything between, so
 * a thumb aiming for "done" has to travel to hit this.
 */
function ArchiveHabitButton({ habit }: { habit: HabitWithStats }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    // Retry from a clean slate; a stale failure would otherwise greet the user.
    if (!nextOpen) setError(null);
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveHabit(habit.id);

      if (result.ok) {
        setOpen(false);
        // `ok: true` carries no message, so the confirmation is written here.
        toast.success(`Archived "${habit.name}". Its history is kept.`);
        return;
      }

      // Kept inline: a toast renders behind the modal popup.
      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        aria-label={`Archive ${habit.name}`}
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/60 hover:text-destructive mt-0.5 -mr-2 size-11 shrink-0"
          />
        }
      >
        <Archive aria-hidden />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Archive "${habit.name}"?`}</DialogTitle>
          <DialogDescription>
            It leaves your checklist and its streak stops counting. Nothing is
            deleted — adding a habit with the same name brings it back with its
            history.
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
            onClick={handleArchive}
          >
            {pending ? "Archiving…" : "Archive habit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
