import { DashboardPanel } from "@/app/_components/dashboard-panel";
import { EmptyState } from "@/app/_components/empty-state";
import { HabitChecklist } from "@/app/habits/_components/habit-checklist";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import { getHabitChecklist } from "@/lib/habits";

/**
 * The day's checklist, inside the same panel as every other block.
 *
 * The interactive half (`HabitChecklist`) is reused verbatim: it owns the
 * optimistic tick and the `toggleHabit` server action, and `today` was resolved
 * on the server below so the client clock can never tick off the wrong day. The
 * wrapper only strips that component's own card chrome — the panel around it is
 * already a surface, and a card inside a card would read as a nested box — and
 * neutralises the one warm accent it still carries, because on this screen
 * colour is the data blue and nothing else.
 */
export async function TodayHabits() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);
  const habits = await getHabitChecklist(user.id, user.timezone);

  if (habits.length === 0) {
    return (
      <DashboardPanel title="Today's habits" headingId="today-habits-heading">
        <EmptyState
          description="No habits yet."
          action={{ href: "/habits", label: "Add a habit" }}
        />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      title="Today's habits"
      headingId="today-habits-heading"
      action={{ href: "/habits", label: "Manage" }}
    >
      <div
        className="
          [&_[data-slot=card]]:gap-0
          [&_[data-slot=card]]:overflow-visible
          [&_[data-slot=card]]:rounded-none
          [&_[data-slot=card]]:bg-transparent
          [&_[data-slot=card]]:py-0
          [&_[data-slot=card]]:ring-0
          [&_[data-slot=card-header]]:px-0
          [&_[data-slot=card-header]]:pb-3
          [&_[data-slot=card-title]]:hidden
          [&_[data-slot=card-description]>span:first-child]:mb-1
          [&_[data-slot=card-description]>span:first-child]:block
          [&_[data-slot=card-description]>span:first-child]:text-2xl
          [&_[data-slot=card-description]>span:first-child]:leading-none
          [&_[data-slot=card-description]>span:first-child]:font-medium
          [&_[data-slot=card-description]>span:first-child]:text-foreground
          [&_.tabular-nums]:font-mono
          [&_.text-amber-500]:text-muted-foreground
          [&_li]:border-rule
          [&_li]:px-0
          [&_ul]:border-rule
        "
      >
        <HabitChecklist habits={habits} today={today} />
      </div>
    </DashboardPanel>
  );
}
