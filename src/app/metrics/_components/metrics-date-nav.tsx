"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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

const navButtonClass = cn(
  buttonVariants({ variant: "outline", size: "icon-lg" }),
  "size-11 shrink-0",
);

/**
 * Day picker. Purely a navigator — it never saves metric values.
 *
 * The `<form method="get">` is the no-JS path: submitting reloads
 * `/metrics?date=...` and the page selects that day. With JS, `onChange` pushes
 * the same URL through the router so the transition is instant.
 */
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link
          href={`/metrics?date=${previousDate}`}
          aria-label="Previous day"
          className={navButtonClass}
        >
          <ChevronLeft />
        </Link>

        <form method="get" action="/metrics" className="flex-1">
          <Field>
            <FieldLabel htmlFor="metrics-date" className="sr-only">
              Date
            </FieldLabel>
            <Input
              id="metrics-date"
              type="date"
              name="date"
              defaultValue={selectedDate}
              max={today}
              onChange={handleChange}
              className="h-11 text-base"
            />
          </Field>
          {/* Without JS, a changed date input does not submit itself. */}
          <noscript>
            <button type="submit" className={cn(buttonVariants(), "mt-2 h-11 w-full")}>
              Go to date
            </button>
          </noscript>
        </form>

        {isAtLatestDay ? (
          <button
            type="button"
            disabled
            aria-label="Next day"
            className={cn(navButtonClass, "opacity-50")}
          >
            <ChevronRight />
          </button>
        ) : (
          <Link
            href={`/metrics?date=${addDays(selectedDate, 1)}`}
            aria-label="Next day"
            className={navButtonClass}
          >
            <ChevronRight />
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {selectedDate === today ? "Showing today" : "Editing a past day"}
        </span>
        {selectedDate === today ? null : (
          <Link href="/metrics" className={buttonVariants({ variant: "link", size: "sm" })}>
            Jump to today
          </Link>
        )}
      </div>
    </div>
  );
}
