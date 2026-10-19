import Link from "next/link";
import { Flame } from "lucide-react";

import { EmptyState } from "@/app/_components/empty-state";
import { HabitChecklist } from "@/app/habits/_components/habit-checklist";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import { getHabitChecklist } from "@/lib/habits";

export async function TodayHabits() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);
  const habits = await getHabitChecklist(user.id, user.timezone);

  if (habits.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="No habits yet"
        description="Add a habit and tick it off each day to build a streak."
        action={{ href: "/habits", label: "Add a habit" }}
      />
    );
  }

  return (
    <section
      aria-labelledby="today-habits-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        {/*
          No count here: the checklist below already owns a live tally that
          follows the optimistic tick, and two counts disagree mid-flight.
        */}
        <h2
          id="today-habits-heading"
          className="text-base font-semibold tracking-tight"
        >
          Today&apos;s habits
        </h2>

        <Link
          href="/habits"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
        >
          Manage
        </Link>
      </div>

      {/*
        The checklist itself is reused verbatim: it owns the optimistic tick and
        the `toggleHabit` call. `today` was resolved on the server above, so the
        client clock can never tick off the wrong day.
      */}
      <HabitChecklist habits={habits} today={today} />
    </section>
  );
}
