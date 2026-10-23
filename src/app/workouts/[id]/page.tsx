import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { ExerciseBlock } from "@/app/workouts/[id]/_components/exercise-block";
import {
  DiscardSessionButton,
  FinishSessionButton,
} from "@/app/workouts/[id]/_components/session-actions";
import { SessionKpis } from "@/app/workouts/[id]/_components/session-kpis";
import { SessionSkeleton } from "@/app/workouts/[id]/_components/session-skeleton";
import {
  formatLongDate,
  sessionDay,
} from "@/app/workouts/_components/format";
import { ExercisePickerButton } from "@/components/exercise-picker";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutSession } from "@/lib/workouts";

export const metadata: Metadata = {
  title: "Workout session",
};

/**
 * One workout session, as a stack of exercise panels.
 *
 * `params` is a Promise and is awaited INSIDE the boundary, together with the
 * DB read. Resolving the id in the page body would make the route uncached above
 * its Suspense boundary and fail `next build` under Cache Components.
 */
export default function WorkoutSessionPage({
  params,
}: PageProps<"/workouts/[id]">) {
  return (
    <PageShell width="wide">
      <Suspense fallback={<SessionSkeleton />}>
        <SessionContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function SessionContent({
  params,
}: Pick<PageProps<"/workouts/[id]">, "params">) {
  const { id } = await params;
  const user = await getCurrentUser();

  const session = await getWorkoutSession(user.id, id);

  // Missing and not-owned are the same answer. Rendering a blank session here
  // would leak that difference and leave a dead page behind a stale link.
  if (session === null) notFound();

  // A planned session's date is the day it is for; an ad-hoc one's date is the
  // day it was started, resolved in the user's own zone.
  const day =
    session.scheduledForIso ?? sessionDay(session.startedAtIso, user.timezone);

  const setCount = session.blocks.reduce(
    (total, block) => total + block.sets.length,
    0,
  );

  const rawVolumeKg = session.blocks.reduce(
    (total, block) =>
      total +
      block.sets.reduce(
        (blockTotal, set) => blockTotal + set.weightKg * set.reps,
        0,
      ),
    0,
  );

  // No set means no volume to report. With sets, 0.0 kg is a real reading —
  // every set was bodyweight.
  const volumeKg =
    setCount === 0 ? null : Math.round(rawVolumeKg * 10) / 10;

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink href="/workouts" label="Workouts" className="-ml-2" />

        <ScreenHeader
          title={session.name}
          description={`${formatLongDate(day)} · ${session.isCompleted ? "Finished" : "In progress"}`}
          action={
            session.isCompleted ? undefined : (
              <FinishSessionButton sessionId={session.id} />
            )
          }
        />

        {session.notes === null ? null : (
          <p className="text-muted-foreground max-w-[62ch] text-sm whitespace-pre-line">
            {session.notes}
          </p>
        )}
      </div>

      <SessionKpis
        setCount={setCount}
        volumeKg={volumeKg}
        exerciseCount={session.blocks.length}
        className="mt-9"
      />

      {session.blocks.length === 0 ? (
        <section
          aria-labelledby="empty-exercises-heading"
          className="bg-card rounded-lg p-5 sm:p-6"
        >
          <h2
            id="empty-exercises-heading"
            className="text-base leading-snug font-medium"
          >
            Exercises
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {session.isCompleted
              ? "This session was finished without any exercises."
              : "No exercises yet."}
          </p>

          {session.isCompleted ? null : (
            <>
              <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
                Weight 0 counts as bodyweight, so pull-ups and dips still set a
                baseline.
              </p>
              <div className="mt-4">
                <ExercisePickerButton
                  target={{ kind: "session", sessionId: session.id }}
                  className="h-10 rounded-md px-4 text-sm"
                />
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {session.blocks.map((block) => (
            <ExerciseBlock
              key={block.id}
              block={block}
              timezone={user.timezone}
              canEdit={!session.isCompleted}
            />
          ))}
        </div>
      )}

      {session.isCompleted ? (
        <p className="text-muted-foreground text-sm">
          This session is finished — its sets are history and cannot be edited.
        </p>
      ) : session.blocks.length === 0 ? (
        <div className="flex justify-end">
          <DiscardSessionButton sessionId={session.id} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ExercisePickerButton
            target={{ kind: "session", sessionId: session.id }}
            className="h-10 rounded-md px-4 text-sm"
          />
          <DiscardSessionButton sessionId={session.id} />
        </div>
      )}
    </>
  );
}
