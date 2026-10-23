"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { toggleHabit } from "@/app/habits/actions";
import type { HabitWithStats } from "@/lib/habits";

/**
 * The checklist's shared state, so the tally in the screen header and the
 * checkboxes below it move on the same frame.
 *
 * The provider owns the only copy of the optimistic map. The header count
 * (`HabitCount`) and the rows (`HabitRow`) both read it through `useHabitDay`;
 * without that, the count would have to be re-derived from server props and
 * would lag one round trip behind the box the user just tapped.
 *
 * `today` is passed in from the server. The browser clock is never consulted:
 * a phone set to another timezone would otherwise tick off the wrong day.
 */
type HabitDayContextValue = {
  habits: HabitWithStats[];
  total: number;
  doneToday: number;
  checkedFor: (habit: HabitWithStats) => boolean;
  onToggle: (habitId: string, completed: boolean) => void;
};

const HabitDayContext = createContext<HabitDayContextValue | null>(null);

/** One queued tick. Applied optimistically, discarded when the action settles. */
type OptimisticToggle = { habitId: string; completed: boolean };

type HabitDayProviderProps = {
  habits: HabitWithStats[];
  /** Server-resolved "today" in the user's timezone. */
  today: string;
  children: ReactNode;
};

/**
 * The unchecked/checked seed, applied optimistically per tap.
 *
 * Streaks and the 7-day rate are *not* recomputed here: they arrive from the
 * server on the re-render triggered by `revalidatePath("/habits")` and
 * `revalidatePath("/")`, so a rollback has nothing to undo. If the action
 * fails, the transition ends without new props and the optimistic map falls
 * away — the box snaps back to the value the database confirmed.
 */
export function HabitDayProvider({
  habits,
  today,
  children,
}: HabitDayProviderProps) {
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

  const onToggle = useCallback(
    (habitId: string, completed: boolean) => {
      startTransition(async () => {
        applyOptimisticToggle({ habitId, completed });

        const result = await toggleHabit(habitId, today, completed);

        // A toast, unlike the create form's inline status, because a tick has
        // no form to attach a message to and the box has already flipped.
        if (!result.ok) toast.error(result.message);
      });
    },
    [applyOptimisticToggle, startTransition, today],
  );

  const checkedFor = useCallback(
    (habit: HabitWithStats) =>
      optimisticChecked.get(habit.id) ?? habit.checkedToday,
    [optimisticChecked],
  );

  // Counted from the optimistic map, so the header tally moves with the boxes.
  const doneToday = habits.filter(checkedFor).length;

  const value = useMemo<HabitDayContextValue>(
    () => ({
      habits,
      total: habits.length,
      doneToday,
      checkedFor,
      onToggle,
    }),
    [habits, doneToday, checkedFor, onToggle],
  );

  return (
    <HabitDayContext.Provider value={value}>
      {children}
    </HabitDayContext.Provider>
  );
}

export function useHabitDay(): HabitDayContextValue {
  const context = useContext(HabitDayContext);

  if (context === null) {
    throw new Error("useHabitDay must be used inside a HabitDayProvider.");
  }

  return context;
}

/**
 * The screen header's supporting line.
 *
 * A real count, not an adjective: it is the number that answers "what is left
 * today?", and it is read from the optimistic map so it changes on the tap, not
 * after the round trip. Zero habits prints "0 of 0" rather than pretending the
 * day is complete.
 */
export function HabitCount() {
  const { doneToday, total } = useHabitDay();

  return (
    <span>
      <span className="font-mono tabular-nums">{doneToday}</span> of{" "}
      <span className="font-mono tabular-nums">{total}</span> done today
    </span>
  );
}
