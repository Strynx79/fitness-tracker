import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { ExerciseGroup } from "@/app/workouts/[id]/_components/exercise-group";
import { LogSetForm } from "@/app/workouts/[id]/_components/log-set-form";
import { SessionHeader } from "@/app/workouts/[id]/_components/session-header";
import { SessionSkeleton } from "@/app/workouts/[id]/_components/session-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import {
  getExerciseSuggestions,
  getWorkoutSession,
} from "@/lib/workouts";
import { formatInstant } from "@/lib/workout-format";

export const metadata: Metadata = {
  title: "Workout session",
};

/**
 * One workout session.
 *
 * `params` is a Promise and is awaited INSIDE the boundary, together with both
 * DB reads. Resolving the id in the page body would make the route uncached
 * above its Suspense boundary and fail `next build` under Cache Components.
 */
export default function WorkoutSessionPage({
  params,
}: PageProps<"/workouts/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <Link
        href="/workouts"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All workouts
      </Link>

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

  const [session, suggestions] = await Promise.all([
    getWorkoutSession(user.id, id),
    getExerciseSuggestions(user.id),
  ]);

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
        completedAtLabel={
          session.completedAtIso === null
            ? null
            : formatInstant(session.completedAtIso, user.timezone)
        }
        isCompleted={session.isCompleted}
      />

      {session.isCompleted ? (
        <p className="text-muted-foreground px-1 text-sm">
          This session is finished.
        </p>
      ) : (
        <LogSetForm sessionId={session.id} suggestions={suggestions} />
      )}

      {session.groups.length === 0 ? (
        <EmptySession isCompleted={session.isCompleted} />
      ) : (
        <div className="flex flex-col gap-3">
          {session.groups.map((group) => (
            <ExerciseGroup
              key={group.exerciseKey}
              group={group}
              timezone={user.timezone}
              canDelete={!session.isCompleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptySession({ isCompleted }: { isCompleted: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No sets yet</CardTitle>
        <CardDescription>
          {isCompleted
            ? "This session was finished without any sets."
            : "Log the first set above — the exercise name stays put for the next one."}
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
