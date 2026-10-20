import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import {
  HabitsCardSkeleton,
  LastWorkoutSkeleton,
  WeightCardSkeleton,
} from "@/app/_components/dashboard-skeletons";
import { LastWorkout } from "@/app/_components/last-workout";
import { TodayHabits } from "@/app/_components/today-habits";
import { WeightCard } from "@/app/_components/weight-card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate, todayIso } from "@/lib/date";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Today",
};

/**
 * A `YYYY-MM-DD` calendar day, formatted against its UTC-midnight instant.
 *
 * `timeZone: "UTC"` is load-bearing: the value is a date-only string from
 * `todayIso`, and re-reading it in the runtime's zone would print the previous
 * day for anywhere west of UTC.
 */
const FRIENDLY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * The dashboard.
 *
 * The page body is synchronous and contains no request data, so the whole shell
 * — title, date fallback and the three card skeletons — is prerendered. Each
 * card has its OWN `<Suspense>` boundary: one slow query only holds its own
 * card back instead of making the page as slow as the slowest read.
 *
 * Nothing here uses `use cache`. The cards read the database per request, and
 * the boundary is what keeps the shell static.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>

          {/* The only header fragment that needs the user's timezone. */}
          <Suspense
            fallback={
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            }
          >
            <DashboardDate />
          </Suspense>
        </div>

        {/*
          Settings is deliberately not a fifth tab: the bottom bar is for daily
          use, and this is a rare trip. An icon-only link needs an accessible
          name, and size-11 keeps the tap target at 44px.
        */}
        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-lg" }),
            "size-11 shrink-0",
          )}
        >
          <Settings aria-hidden className="size-5" />
        </Link>
      </header>

      <div className="flex flex-col gap-5">
        <Suspense fallback={<WeightCardSkeleton />}>
          <WeightCard />
        </Suspense>

        <Suspense fallback={<HabitsCardSkeleton />}>
          <TodayHabits />
        </Suspense>

        <Suspense fallback={<LastWorkoutSkeleton />}>
          <LastWorkout />
        </Suspense>
      </div>
    </main>
  );
}

async function DashboardDate() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);

  return (
    <p className="text-muted-foreground text-sm">
      <time dateTime={today}>{FRIENDLY_DATE.format(parseIsoDate(today))}</time>
      {" — "}your day at a glance.
    </p>
  );
}
