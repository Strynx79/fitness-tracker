"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/date";
import { cn } from "@/lib/utils";

type MetricsDateNavProps = {
  /** The `YYYY-MM-DD` day currently being viewed/edited. */
  selectedDate: string;
  /**
   * The user's "today", resolved server-side from their timezone. Passed in
   * rather than computed here: `new Date()` in the browser would use the device
   * clock, which is exactly the drift `@/lib/date` exists to avoid.
   */
  today: string;
};

/**
 * The date control, sized and weighted for a header action.
 *
 * No filled button: two quiet arrow links around a 40px date field. The
 * `<form method="get">` is the no-JS path — submitting reloads
 * `/metrics?date=…` and the page selects that day. With JS, `onChange` pushes
 * the same URL through the router so the transition is instant.
 */
const ARROW =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-10 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none";

export function MetricsDateNav({ selectedDate, today }: MetricsDateNavProps) {
  const router = useRouter();

  const previousDate = addDays(selectedDate, -1);
  // The action rejects future dates, so navigation stops at today.
  const isAtLatestDay = selectedDate >= today;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    // An empty value means the user cleared the field mid-edit; pushing
    // `/metrics?date=` would silently bounce them back to today.
    if (!value || value === selectedDate) return;
    router.push(`/metrics?date=${value}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/metrics?date=${previousDate}`}
        aria-label="Previous day"
        className={ARROW}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>

      <form method="get" action="/metrics" className="flex items-center">
        <label htmlFor="metrics-date" className="sr-only">
          Date
        </label>
        <Input
          id="metrics-date"
          type="date"
          name="date"
          defaultValue={selectedDate}
          max={today}
          onChange={handleChange}
          className="bg-card h-10 w-36 rounded-md px-2 font-mono text-base tabular-nums sm:text-[13px]"
        />
        {/* Without JS, a changed date input does not submit itself. */}
        <noscript>
          <button
            type="submit"
            className="border-input hover:bg-muted ml-1 h-10 rounded-md border px-3 text-sm"
          >
            Go
          </button>
        </noscript>
      </form>

      {isAtLatestDay ? (
        <button
          type="button"
          disabled
          aria-label="Next day"
          className={cn(ARROW, "pointer-events-none opacity-40")}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      ) : (
        <Link
          href={`/metrics?date=${addDays(selectedDate, 1)}`}
          aria-label="Next day"
          className={ARROW}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}

      {selectedDate === today ? null : (
        <Link
          href="/metrics"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-10 items-center rounded-md px-2 text-[13px] font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Today
        </Link>
      )}
    </div>
  );
}
