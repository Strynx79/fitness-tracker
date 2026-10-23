import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { WorkoutSectionTabs } from "@/app/_components/workout-section-tabs";
import { NewSessionForm } from "@/app/workouts/_components/new-session-form";
import { SessionList } from "@/app/workouts/_components/session-list";
import { TodayPlan, type TodaySession } from "@/app/workouts/_components/today-plan";
import { UpcomingList } from "@/app/workouts/_components/upcoming-list";
import { WorkoutsSkeleton } from "@/app/workouts/_components/workouts-skeleton";
import { describeLastSession } from "@/app/workouts/_components/format";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import {
  getInProgressSession,
  getUpcomingWorkouts,
  getWorkoutSession,
  getWorkoutSessionList,
  type WorkoutSessionSummary,
} from "@/lib/workouts";

export const metadata: Metadata = {
  title: "Workouts",
};

/**
 * Workout history and the start-session form.
 *
 * The page body stays static; everything that needs the database streams behind
 * one Suspense boundary. The header's fact ("Last session 3 days ago") also
 * depends on that data, so it streams with the body rather than claiming
 * something before the query answers.
 */
export default function WorkoutsPage() {
  return (
    <PageShell width="wide">
      <Suspense fallback={<WorkoutsSkeleton />}>
        <WorkoutsContent />
      </Suspense>
    </PageShell>
  );
}

/**
 * Newest completed session first. `getWorkoutSessionList` already returns
 * newest-started first, so sorting by `completedAt` is only needed to find the
 * true "last session" when an older-started session was finished later.
 */
function findLastCompleted(
  sessions: WorkoutSessionSummary[],
): WorkoutSessionSummary | null {
  let latest: WorkoutSessionSummary | null = null;

  for (const session of sessions) {
    if (session.completedAtIso === null) continue;
    if (
      latest === null ||
      latest.completedAtIso === null ||
      session.completedAtIso > latest.completedAtIso
    ) {
      latest = session;
    }
  }

  return latest;
}

async function WorkoutsContent() {
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);

  const [sessions, upcoming, openSession] = await Promise.all([
    getWorkoutSessionList(user.id, today),
    getUpcomingWorkouts(user.id, today),
    getInProgressSession(user.id, today),
  ]);

  // `getInProgressSession` is still needed even though history now includes
  // `scheduledFor: null` rows: the open session needs its detail read (blocks
  // and sets) to be shown as today's session, which the list summary lacks.
  // The detail read supplies the
  // exercise names the panel needs.
  const openDetail =
    openSession === null
      ? null
      : await getWorkoutSession(user.id, openSession.id);

  const isInProgress =
    openDetail !== null && openDetail.scheduledForIso === null;

  const plannedToday =
    openDetail !== null &&
    openDetail.scheduledForIso !== null &&
    openDetail.scheduledForIso === today;

  const todaySession: TodaySession | null =
    openDetail === null || (!isInProgress && !plannedToday)
      ? null
      : {
          id: openDetail.id,
          name: openDetail.name,
          exerciseNames: openDetail.blocks.map((block) => block.exerciseName),
          scheduledForIso: openDetail.scheduledForIso,
        };

  const lastCompleted = findLastCompleted(sessions);

  const description =
    lastCompleted !== null && lastCompleted.completedAtIso !== null
      ? describeLastSession(lastCompleted.completedAtIso, user.timezone, today)
      : isInProgress
        ? "In progress now."
        : todaySession !== null
          ? "Planned for today."
          : "0 sessions logged.";

  // The session in the panel above is not history yet — showing it twice would
  // make today's workout read as something that already happened. Any other
  // plan dated today is excluded for the same reason.
  const history = sessions.filter(
    (session) =>
      session.id !== todaySession?.id &&
      !(session.completedAtIso === null && session.scheduledForIso === today),
  );

  return (
    <>
      <ScreenHeader
        title="Workouts"
        description={description}
        action={
          <Link
            href="#start-session"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md px-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Start a workout
          </Link>
        }
      />

      <WorkoutSectionTabs active="history" />

      <TodayPlan session={todaySession} isInProgress={isInProgress} />

      <UpcomingList workouts={upcoming} />

      <SessionList
        sessions={history}
        timezone={user.timezone}
        today={today}
      />

      <NewSessionForm />
    </>
  );
}
