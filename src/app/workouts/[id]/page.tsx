import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Library } from "lucide-react";

import { ExerciseGroup } from "@/app/workouts/[id]/_components/exercise-group";
import { LogSetForm } from "@/app/workouts/[id]/_components/log-set-form";
import { SessionHeader } from "@/app/workouts/[id]/_components/session-header";
import { SessionSkeleton } from "@/app/workouts/[id]/_components/session-skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { capitalizeExerciseName } from "@/lib/exercise";
import { getExercise } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { getExerciseSuggestions, getWorkoutSession } from "@/lib/workouts";
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
  searchParams,
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
        <SessionContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SessionContent({
  params,
  searchParams,
}: Pick<PageProps<"/workouts/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();

  // A picked catalog exercise arrives as `?exerciseId=0025` — the DATASET id, so
  // library URLs stay stable. The internal row id is resolved here, server-side,
  // and only that resolved id ever reaches the form.
  const rawDatasetId = query.exerciseId;
  const datasetId = (
    typeof rawDatasetId === "string"
      ? rawDatasetId
      : Array.isArray(rawDatasetId)
        ? (rawDatasetId[0] ?? "")
        : ""
  ).trim();

  const [session, suggestions, catalogExercise] = await Promise.all([
    getWorkoutSession(user.id, id),
    getExerciseSuggestions(user.id),
    datasetId === "" ? Promise.resolve(null) : getExercise(datasetId),
  ]);

  // Missing and not-owned are the same answer. Rendering a blank session here
  // would leak that difference and leave a dead page behind a stale link.
  if (session === null) notFound();

  const prefill =
    catalogExercise === null
      ? undefined
      : {
          exerciseId: catalogExercise.id,
          exerciseName: capitalizeExerciseName(catalogExercise.name),
        };

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
        <>
          <LogSetForm
            key={prefill?.exerciseId ?? "free-typed"}
            sessionId={session.id}
            suggestions={suggestions}
            prefill={prefill}
          />
          <Link
            href="/exercises"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full gap-2")}
          >
            <Library aria-hidden className="size-4" />
            Browse the exercise library
          </Link>
        </>
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
