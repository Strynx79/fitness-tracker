"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleHabit } from "@/app/habits/actions";
import { HabitRow } from "@/app/habits/_components/habit-row";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HabitWithStats } from "@/lib/habits";

type HabitChecklistProps = {
  habits: HabitWithStats[];
  /**
   * Server-resolved "today" in the user's timezone. Never derived here: the
   * browser clock can be in a different zone than the one the checklist was
   * built for, and `toggleHabit` rejects the mismatch.
   */
  today: string;
};

/** One queued tick. Applied optimistically, discarded when the action settles. */
type OptimisticToggle = { habitId: string; completed: boolean };

/**
 * The checklist, and the only thing that knows a checkbox is mid-flight.
 *
 * The checkbox flips from `useOptimistic` on the same frame as the tap. Streaks
 * and the 7-day rate are *not* computed here: they come from the server on the
 * re-render that `revalidatePath("/habits")` triggers, so a rollback has nothing
 * to undo. If the action fails, the transition ends without new props and the
 * optimistic map falls away — the box snaps back to the server's value.
 */
export function HabitChecklist({ habits, today }: HabitChecklistProps) {
  // Re-seeded whenever the server sends new data, so the passthrough is always
  // the last thing the database confirmed.
  const serverChecked = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit.checkedToday])),
    [habits],
  );

  const [optimisticChecked, applyOptimisticToggle] = useOptimistic(
    serverChecked,
    (state, toggle: OptimisticToggle) =>
      new Map(state).set(toggle.habitId, toggle.completed),
  );

  const [, startTransition] = useTransition();

  function handleToggle(habitId: string, completed: boolean) {
    startTransition(async () => {
      applyOptimisticToggle({ habitId, completed });

      const result = await toggleHabit(habitId, today, completed);

      // A toast, unlike the create form's inline status, because a tick has no
      // form to attach a message to and the box has already flipped.
      if (!result.ok) toast.error(result.message);
    });
  }

  const checkedFor = (habit: HabitWithStats) =>
    optimisticChecked.get(habit.id) ?? habit.checkedToday;

  // Counted from the optimistic map, so the tally moves with the checkboxes.
  const doneToday = habits.filter(checkedFor).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist</CardTitle>
        <CardDescription>
          <span className="tabular-nums">
            {doneToday} of {habits.length}
          </span>{" "}
          done today. One missed day won&apos;t break a streak — two in a row
          will.
        </CardDescription>
      </CardHeader>

      <ul className="divide-y border-t">
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            checked={checkedFor(habit)}
            onToggle={handleToggle}
          />
        ))}
      </ul>
    </Card>
  );
}
