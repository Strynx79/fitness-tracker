import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  /**
   * `wide` (1200px) for data screens — lists, charts, tables. The default
   * (880px) suits forms and settings, where a 1200px measure would leave the
   * fields stranded in a field of ground.
   */
  width?: "default" | "wide";
  children: ReactNode;
};

/**
 * The page frame.
 *
 * One place owns the outer paddings, the maximum measure and the 24px rhythm
 * between blocks, so every screen shares the same edges instead of each page
 * re-declaring its own `mx-auto max-w-… px-…`. The matching column width for
 * wide screens lives here too, so the app bar (which is capped at the same
 * 1200px) lines its wordmark up with the page's first glyph.
 */
export function PageShell({ width = "default", children }: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6",
        width === "wide" ? "max-w-[1200px]" : "max-w-[880px]",
      )}
    >
      {children}
    </main>
  );
}

type ScreenHeaderProps = {
  /** A noun, not a greeting: the screen's name. */
  title: string;
  /**
   * One sentence about the data, not about the interface. Say what the reader
   * is looking at ("Last weigh-in 6 days ago"), never what the page does
   * ("This page shows your metrics").
   */
  description?: ReactNode;
  /** A real control, right-aligned and baseline-aligned with the title. */
  action?: ReactNode;
};

/** The screen's one `h1` and its supporting line. */
export function ScreenHeader({ title, description, action }: ScreenHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description === undefined ? null : (
          <p className="text-muted-foreground max-w-[62ch] text-sm">
            {description}
          </p>
        )}
      </div>
      {action === undefined ? null : <div className="shrink-0">{action}</div>}
    </header>
  );
}
