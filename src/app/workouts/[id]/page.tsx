import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ExerciseBlock } from "@/app/workouts/[id]/_components/exercise-block";
import { SessionHeader } from "@/app/workouts/[id]/_components/session-header";
import { SessionSkeleton } from "@/app/workouts/[id]/_components/session-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExercisePickerButton } from "@/components/exercise-picker";
import { BackLink } from "@/app/_components/back-link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutSession } from "@/lib/workouts";
import { formatCalendarDate, formatInstant } from "@/lib/workout-format";

export const metadata: Metadata = {
  title: "Workout session",
};

/**
 * One workout session, as a stack of exercise cards.
 *
 * `params` is a Promise and is awaited INSIDE the boundary, together with the
 * DB read. Resolving the id in the page body would make the route uncached above
 * its Suspense boundary and fail `next build` under Cache Components.
 */
export default function WorkoutSessionPage({
  params,
}: PageProps<"/workouts/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <BackLink href="/workouts" label="All workouts" />

      <Suspense fallback={<SessionSkeleton />}>
        <SessionContent params={params} />
      </Suspense>
    </main>
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

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader
        sessionId={session.id}
        name={session.name}
        notes={session.notes}
        startedAtLabel={formatInstant(session.startedAtIso, user.timezone)}
        scheduledForLabel={
          session.scheduledForIso === null
            ? null
            : formatCalendarDate(session.scheduledForIso)
        }
        completedAtLabel={
          session.completedAtIso === null
            ? null
            : formatInstant(session.completedAtIso, user.timezone)
        }
        isCompleted={session.isCompleted}
      />

      {session.blocks.length === 0 ? (
        <EmptySession isCompleted={session.isCompleted} />
      ) : (
        <div className="flex flex-col gap-3">
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
        <p className="text-muted-foreground px-1 text-sm">
          This session is finished — its sets are history and cannot be edited.
        </p>
      ) : (
        <ExercisePickerButton target={{ kind: "session", sessionId: session.id }} />
      )}
    </div>
  );
}

function EmptySession({ isCompleted }: { isCompleted: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No exercises yet</CardTitle>
        <CardDescription>
          {isCompleted
            ? "This session was finished without any exercises."
            : "Add the first exercise, then fill in the sets as you go."}
        </CardDescription>
      </CardHeader>
      {isCompleted ? null : (
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Weight 0 counts as bodyweight, so pull-ups and dips still set a
            baseline.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
