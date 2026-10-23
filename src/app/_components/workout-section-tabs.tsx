import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The two halves of the workouts section: the plan and the log.
 *
 * A routine is the plan; a workout is one execution of it. They used to be two
 * destinations — `/routines` reachable only from a block on Home, `/workouts`
 * from the tab bar — so the plan and the log never appeared together. The tab
 * bar now points at this one section, and these two tabs move between its views
 * (the plan at `/routines`, the history at `/workouts`), keeping both URLs and
 * every deep link that already exists.
 *
 * The active view is a prop, not `usePathname`: each page already knows which
 * view it is, so this stays a server component and adds no client JS.
 */
const VIEWS = [
  { href: "/routines", label: "Plan", view: "plan" },
  { href: "/workouts", label: "History", view: "history" },
] as const;

export type WorkoutSectionView = (typeof VIEWS)[number]["view"];

type WorkoutSectionTabsProps = {
  active: WorkoutSectionView;
};

export function WorkoutSectionTabs({ active }: WorkoutSectionTabsProps) {
  return (
    <nav aria-label="Workouts views" className="border-rule flex gap-6 border-b">
      {VIEWS.map((view) => {
        const isActive = view.view === active;

        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={isActive ? "page" : undefined}
            /*
              -mb-px pulls the 2px indicator down onto the nav's own 1px rule, so
              the active tab reads as part of the line rather than floating above
              it. The indicator is as wide as its label.
            */
            className={cn(
              "focus-visible:ring-ring/50 -mb-px rounded-t-sm border-b-2 pb-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "border-foreground text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
