import type { Metadata } from "next";
import { Suspense } from "react";

import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import {
  HabitCount,
  HabitDayProvider,
} from "@/app/habits/_components/habit-day";
import { HabitSheet } from "@/app/habits/_components/habit-checklist";
import { HabitsSkeleton } from "@/app/habits/_components/habits-skeleton";
import { NewHabitForm } from "@/app/habits/_components/new-habit-form";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import { getHabitChecklist } from "@/lib/habits";

export const metadata: Metadata = {
  title: "Habits",
};

/**
 * The checklist screen.
 *
 * Everything below the 880px shell depends on the user's timezone and today's
 * logs, so the whole content streams through one Suspense boundary. The
 * provider is a client island *inside* that boundary: it holds the optimistic
 * ticks, which lets the header's "3 of 5" and the boxes move together instead
 * of the count lagging a round trip behind.
 *
 * The provider renders no DOM of its own, so the header, the sheet and the add
 * form stay direct children of `PageShell` and keep its 24px rhythm.
 */
export default function HabitsPage() {
  return (
    <PageShell>
      <Suspense fallback={<HabitsSkeleton />}>
        <HabitsContent />
      </Suspense>
    </PageShell>
  );
}

async function HabitsContent() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);
  const habits = await getHabitChecklist(user.id, user.timezone);

  return (
    <HabitDayProvider habits={habits} today={today}>
      <ScreenHeader
        title="Habits"
        description={<HabitCount />}
      />

      {/*
        The form sits below the sheet in both states: when there are no habits,
        the sheet keeps its frame and heading and says so, and the form directly
        under it is the action. No dashed empty box, no second empty card.
      */}
      <HabitSheet />
      <NewHabitForm />
    </HabitDayProvider>
  );
}
