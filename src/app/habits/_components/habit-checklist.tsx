"use client";

import { HabitDayProvider, useHabitDay } from "@/app/habits/_components/habit-day";
import { HabitRow } from "@/app/habits/_components/habit-row";
import type { HabitWithStats } from "@/lib/habits";
import { cn } from "@/lib/utils";

type HabitChecklistProps = {
  habits: HabitWithStats[];
  /**
   * Server-resolved "today" in the user's timezone. Never derived here: the
   * browser clock can be in a different zone than the one the checklist was
   * built for, and `toggleHabit` rejects the mismatch.
   */
  today: string;
};

/**
 * The dashboard's copy of the checklist.
 *
 * Kept as a self-contained client island with its original props because the
 * Today screen mounts it inside its own panel; `/habits` uses the provider and
 * sheet separately so the screen header's count can share the same optimistic
 * state. `showCount` keeps the tally that the dashboard panel styles as its
 * figure, while the habits page states it once, in the header.
 */
export function HabitChecklist({ habits, today }: HabitChecklistProps) {
  return (
    <HabitDayProvider habits={habits} today={today}>
      <HabitSheet showCount />
    </HabitDayProvider>
  );
}

type HabitSheetProps = {
  /**
   * The dashboard panel has no room for a second heading, so it prints the
   * count inside the sheet instead. `/habits` keeps the count in the 880px
   * screen header and leaves this off.
   */
  showCount?: boolean;
};

/**
 * Today's checklist: one sheet, four-cornered, with 48–60px ruled rows.
 *
 * The rows are the screen. Everything around the sheet — the header count and
 * the add form below — exists to keep the list honest and refill it; there is
 * no chart and no second list.
 */
export function HabitSheet({ showCount = false }: HabitSheetProps) {
  const { habits, doneToday, total } = useHabitDay();

  return (
    <div className="bg-card rounded-lg">
      <div
        className={cn(
          "border-rule flex flex-col gap-1 border-b px-5 pb-3 sm:px-6",
          // The Today panel supplies its own 14px gap above the block; on this
          // screen the sheet has to make that space itself.
          showCount ? "pt-0" : "pt-4",
        )}
      >
        {/*
          `data-slot` lets the Today screen's wrapper hide this heading (its
          DashboardPanel already names the block) without a second variant of
          the sheet existing.
        */}
        <h2
          data-slot="card-title"
          className="text-base leading-snug font-medium"
        >
          Today
        </h2>

        {showCount ? (
          <p className="text-muted-foreground text-[13px] leading-snug">
            <span className="font-mono tabular-nums">
              {doneToday} of {total}
            </span>{" "}
            done today. One missed day won&apos;t break a streak — two in a row
            will.
          </p>
        ) : null}
      </div>

      {habits.length === 0 ? (
        <p className="text-muted-foreground px-5 py-5 text-sm sm:px-6">
          No habits yet.
        </p>
      ) : (
        <ul className="divide-rule divide-y">
          {habits.map((habit) => (
            <HabitRow key={habit.id} habit={habit} />
          ))}
        </ul>
      )}
    </div>
  );
}
