"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { archiveHabit } from "@/app/habits/actions";
import { useHabitDay } from "@/app/habits/_components/habit-day";
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
import type { HabitWithStats } from "@/lib/habits";
import { cn } from "@/lib/utils";

type HabitRowProps = {
  habit: HabitWithStats;
};

/**
 * One ruled row of the checklist.
 *
 * The checkbox sits at the leading edge with a 44px target, so a thumb aims
 * for the left margin and never has to find a 20px square. The name and its
 * single secondary line share the middle; archive is the only trailing action.
 * Taps between sets are the reason for the sizes, not decoration.
 */
export function HabitRow({ habit }: HabitRowProps) {
  const { checkedFor, onToggle } = useHabitDay();
  const checked = checkedFor(habit);
  const checkboxId = `habit-check-${habit.id}`;

  return (
    <li className="flex items-center pr-2 pl-2">
      {/*
        The box's own `after:` pseudo-element widens the hit area to 44×44, so
        the visible square can stay 20px without being the target. The gutter
        is layout only — a second label around the box would race the input's
        native label activation.
      */}
      <div className="flex w-11 shrink-0 items-center justify-center self-stretch">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(next) => onToggle(habit.id, next)}
          className="size-5 after:-inset-y-3 data-checked:border-data data-checked:bg-data"
        />
      </div>

      <label
        htmlFor={checkboxId}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 py-2"
      >
        <span
          className={cn(
            "truncate text-sm leading-snug font-medium",
            checked && "text-muted-foreground line-through",
          )}
        >
          {habit.name}
        </span>
        <span className="text-muted-foreground truncate text-[13px] leading-snug">
          <HabitDetail habit={habit} />
        </span>
      </label>

      <ArchiveHabitButton habit={habit} />
    </li>
  );
}

/**
 * The one supporting line: the streak first, then either the habit's own note
 * or the 7-day rate when there is no note.
 *
 * Both numbers are mono because they are figures; the words around them stay in
 * the UI face. A zero streak says so instead of printing a celebratory zero,
 * and a capped streak reads "365+ day streak". The note follows the stat on the
 * same line, so a long note truncates instead of pushing the streak out of view.
 */
function HabitDetail({ habit }: { habit: HabitWithStats }) {
  const rate = (
    <span className="font-mono tabular-nums">{habit.completionRate7d}%</span>
  );

  const streak =
    habit.streak === 0 ? (
      <>No streak yet</>
    ) : habit.streakCapped ? (
      <>
        <span className="font-mono tabular-nums">365+</span> day streak
      </>
    ) : (
      <>
        <span className="font-mono tabular-nums">{habit.streak}</span>-day
        streak
      </>
    );

  return (
    <>
      {streak} ·{" "}
      {habit.description === null ? <>{rate} this week</> : habit.description}
    </>
  );
}

/**
 * Soft delete, behind a confirmation.
 *
 * A quiet text action rather than an icon slot: the row's one trailing action
 * should be readable at a glance, and the 44px height keeps it reachable. Its
 * distance from the checkbox matters — a thumb aiming for "done" should not
 * land on "archive".
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
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 h-11 shrink-0 rounded-md px-2 text-[13px] font-normal hover:bg-transparent"
          />
        }
      >
        Archive
      </DialogTrigger>

      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>{`Archive "${habit.name}"?`}</DialogTitle>
          <DialogDescription>
            It leaves your checklist and its streak stops counting. Nothing is
            deleted — adding a habit with the same name brings it back with its
            history.
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-negative text-[13px]">
            {error}
          </p>
        )}

        <DialogFooter className="bg-card">
          <DialogClose
            render={
              <Button variant="ghost" className="h-11" disabled={pending} />
            }
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
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
