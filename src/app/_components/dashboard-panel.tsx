import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  /** The block's one heading, 16/500. A noun, not a sentence. */
  title: string;
  /**
   * Kept by the caller so the section's accessible name does not change when a
   * block swaps between its loading, empty and filled states.
   */
  headingId: string;
  /**
   * The block's one route out. A quiet text action — the dashboard has no
   * filled button: every block is read at a glance between sets, and a column
   * of primary buttons would compete with the numbers.
   */
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
};

/**
 * One section of the Today sheet.
 *
 * The Today screen is a **single surface**, not a grid of cards: the sheet is
 * `bg-card` and the sections inside it are separated by 1px rules, the way a
 * logbook page is ruled. A panel therefore adds padding and a heading, never a
 * box of its own — four identical white cards in a 2×2 grid is the template
 * habit this direction exists to avoid.
 */
export function DashboardPanel({
  title,
  headingId,
  action,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn("p-5 sm:p-6", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-base leading-snug font-medium">
          {title}
        </h2>

        {action === undefined ? null : (
          <Link
            href={action.href}
            /*
              The -my-2.5 lets a 44px touch target sit inside the 24px heading
              line without growing the panel header. Negative margins move the
              hit area, not shrink it.
            */
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -my-2.5 inline-flex h-11 shrink-0 items-center rounded-md px-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {action.label}
          </Link>
        )}
      </div>

      <div className="mt-3.5">{children}</div>
    </section>
  );
}
