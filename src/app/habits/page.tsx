import type { Metadata } from "next";
import { Suspense } from "react";

import { HabitChecklist } from "@/app/habits/_components/habit-checklist";
import { HabitsSkeleton } from "@/app/habits/_components/habits-skeleton";
import { NewHabitForm } from "@/app/habits/_components/new-habit-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { parseIsoDate, todayIso } from "@/lib/date";
import { getHabitChecklist } from "@/lib/habits";

export const metadata: Metadata = {
  title: "Today's habits",
};

/**
 * "Sun, Oct 19"-style label for a `YYYY-MM-DD` calendar day.
 *
 * `timeZone: "UTC"` is load-bearing: `parseIsoDate` pins a date-only value at
 * UTC midnight, and `toLocaleDateString()` would re-read it in whatever zone
 * the runtime happens to be in — printing the previous day for every zone
 * behind UTC.
 */
const FRIENDLY_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatFriendlyDate(isoDate: string): string {
  return FRIENDLY_DATE.format(parseIsoDate(isoDate));
}

export default function HabitsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      {/*
        Everything on this page depends on the user's timezone and today's logs,
        so the whole body streams: the shell below is prerendered, the content
        arrives with the request. Awaiting the DB read in the page body instead
        would block prerendering and fail `next build` under Cache Components.
      */}
      <Suspense fallback={<HabitsSkeleton />}>
        <HabitsContent />
      </Suspense>
    </main>
  );
}

async function HabitsContent() {
  const user = await getCurrentUser();
  const habits = await getHabitChecklist(user.id, user.timezone);
  const today = todayIso(user.timezone);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Today</h1>
        <p className="text-muted-foreground text-sm">
          <time dateTime={today}>{formatFriendlyDate(today)}</time> — tick off what
          you got done.
        </p>
      </header>

      <NewHabitForm />

      {habits.length === 0 ? (
        <EmptyHabits />
      ) : (
        // `today` is resolved on the server and handed down. The client clock is
        // never consulted: a phone set to another timezone would otherwise tick
        // off the wrong day.
        <HabitChecklist habits={habits} today={today} />
      )}
    </>
  );
}

/** First run, which is the common case — so it explains the loop, not just "empty". */
function EmptyHabits() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No habits yet</CardTitle>
        <CardDescription>
          Add one above — something small enough that you&apos;d never skip it.
          Tick it off each day to build a streak; a single missed day won&apos;t
          break it, but two in a row will.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
