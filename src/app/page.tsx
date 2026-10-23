import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  HabitsCardSkeleton,
  LastWorkoutSkeleton,
  TodayPlanSkeleton,
  WeightCardSkeleton,
} from "@/app/_components/dashboard-skeletons";
import { LastWorkout } from "@/app/_components/last-workout";
import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { TodayHabits } from "@/app/_components/today-habits";
import { TodayPlan } from "@/app/_components/today-plan";
import { WeightCard } from "@/app/_components/weight-card";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate, todayIso } from "@/lib/date";

export const metadata: Metadata = {
  title: "Today",
};

/**
 * The header's date, written the way the direction deals it: "Friday, 23
 * October". Two formatters rather than one because `en-GB` omits the comma and
 * `en-US` puts the month first; neither alone matches the copy.
 *
 * `timeZone: "UTC"` is load-bearing: the value is a date-only string from
 * `todayIso`, and re-reading it in the runtime's zone would print the previous
 * day for anywhere west of UTC.
 */
const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: "UTC",
});

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Friday, 23 October" for a `YYYY-MM-DD` calendar day. */
function formatFriendlyDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${WEEKDAY.format(date)}, ${DAY_MONTH.format(date)}`;
}

/**
 * The dashboard.
 *
 * The page body is synchronous and contains no request data, so the whole shell
 * — title, date fallback and the four block skeletons — is prerendered. Each
 * block has its OWN `<Suspense>` boundary: one slow query only holds its own
 * block back instead of making the page as slow as the slowest read.
 *
 * On phones the blocks stack plan → weight → habits → last workout: today's
 * session is the question the screen exists to answer, the weight is the state
 * figure, the checklist is the day's remaining action, and the last session is
 * context. At `lg` the plan and the checklist share the wide column while the
 * weight and the last session stack in the narrow one.
 *
 * Both column wrappers are `display: contents` on phones, which lets their
 * blocks interleave in the reading order above; from `lg` they become the two
 * flex columns. The four fixed order values keep plan above habits and weight
 * above last once the wrappers are real again.
 *
 * Nothing here uses `use cache`. The blocks read the database per request, and
 * the boundary is what keeps the shell static.
 */
export default function DashboardPage() {
  return (
    <PageShell width="wide">
      <ScreenHeader
        title="Today"
        description={
          <Suspense
            fallback={<span aria-hidden className="inline-block h-5 w-40" />}
          >
            <DashboardDate />
          </Suspense>
        }
        action={
          <Link
            href="/settings"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md px-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:hidden"
          >
            Settings
          </Link>
        }
      />

      <div className="mt-9 overflow-hidden rounded-lg bg-card lg:grid lg:grid-cols-12 lg:divide-x lg:divide-rule">
        <div className="flex min-w-0 flex-col divide-y divide-rule lg:col-span-7">
          <Suspense fallback={<TodayPlanSkeleton />}>
            <TodayPlan />
          </Suspense>

          <Suspense fallback={<HabitsCardSkeleton />}>
            <TodayHabits />
          </Suspense>
        </div>

        <div className="flex min-w-0 flex-col divide-y divide-rule lg:col-span-5">
          <Suspense fallback={<WeightCardSkeleton />}>
            <WeightCard />
          </Suspense>

          <Suspense fallback={<LastWorkoutSkeleton />}>
            <LastWorkout />
          </Suspense>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * The only header fragment that needs the user's timezone. It streams inside
 * the Suspense boundary above; the h1 and the settings link stay in the static
 * shell.
 */
async function DashboardDate() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);

  return <time dateTime={today}>{formatFriendlyDate(today)}</time>;
}
