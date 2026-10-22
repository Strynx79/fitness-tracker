import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Play } from "lucide-react";

import { ScheduleExerciseButton } from "@/app/exercises/[datasetId]/_components/schedule-exercise-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { capitalizeExerciseName } from "@/lib/exercise";
import {
  GYM_VISUAL_ATTRIBUTION,
  exerciseMediaUrl,
} from "@/lib/exercise-media";
import { getExercise } from "@/lib/exercises";
import { getCurrentUser } from "@/lib/auth";
import { todayIso, addDays } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getInProgressSession } from "@/lib/workouts";

type ExerciseDetailContentProps = {
  params: PageProps<"/exercises/[datasetId]">["params"];
};

/**
 * The streamed half of the detail page.
 *
 * `params`, the query and the 404 decision all live inside the boundary: a
 * missing id must not make the route uncached above its Suspense fallback.
 */
export async function ExerciseDetailContent({
  params,
}: ExerciseDetailContentProps) {
  const { datasetId } = await params;
  const user = await getCurrentUser();
  const today = todayIso(user.timezone);
  const tomorrow = addDays(today, 1);

  // Both reads are request-shaped and belong inside this boundary. The open
  // session decides whether the CTA can send the pick straight back to a workout
  // or has to start at the workouts page.
  const [exercise, inProgress] = await Promise.all([
    getExercise(datasetId),
    getInProgressSession(user.id, today),
  ]);

  // Missing and malformed are the same answer, so an id cannot be probed.
  if (exercise === null) notFound();

  const name = capitalizeExerciseName(exercise.name);
  // Hotlinked dataset media; `null` when the row has no path or an unexpected one.
  const gifUrl = exerciseMediaUrl(exercise.gifPath);

  // The dataset repeats muscles across `target`, `muscle_group` and
  // `secondary_muscles` ("abs" often appears in all three). Render each once,
  // in priority order, so the badge row reads as a list rather than a tally.
  const muscles: string[] = [];
  const seenMuscles = new Set<string>();
  for (const muscle of [
    exercise.target,
    exercise.muscleGroup ?? "",
    ...exercise.secondaryMuscles,
  ]) {
    const key = muscle.trim().toLowerCase();
    if (key === "" || seenMuscles.has(key)) continue;
    seenMuscles.add(key);
    muscles.push(muscle.trim());
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge>{capitalizeExerciseName(exercise.target)}</Badge>
          <Badge variant="secondary">
            {capitalizeExerciseName(exercise.equipment)}
          </Badge>
          <Badge variant="outline">
            {capitalizeExerciseName(exercise.bodyPart)}
          </Badge>
        </div>
      </header>

      {gifUrl === null ? null : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2">
            {/*
              A plain <img>, not next/image: this is a 180×180 animated GIF, the
              optimizer would need remotePatterns for the dataset host and adds
              nothing at this size. Hotlinked on purpose — the media is © Gym
              visual and is not vendored into this repository.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gifUrl}
              alt={`${name} demonstration`}
              width={180}
              height={180}
              loading="lazy"
              className="bg-muted size-[180px] rounded-lg border object-contain"
            />
            <p className="text-muted-foreground text-[0.7rem]">
              {GYM_VISUAL_ATTRIBUTION}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How to do it</CardTitle>
          <CardDescription>
            {exercise.stepsEn.length} steps, in order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exercise.stepsEn.length === 0 ? (
            <p className="text-sm leading-relaxed">{exercise.instructionsEn}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {exercise.stepsEn.map((step, index) => (
                <li key={`${index}-${step.slice(0, 24)}`} className="flex gap-3">
                  <span
                    aria-hidden
                    className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Muscles worked</CardTitle>
          <CardDescription>
            Primary target first, then the muscles assisting it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {muscles.map((muscle, index) => (
            <Badge
              key={muscle}
              // The first entry is `target`; the rest are supporting muscles.
              variant={index === 0 ? "default" : "outline"}
            >
              {capitalizeExerciseName(muscle)}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watch it</CardTitle>
          <CardDescription>
            Opens a YouTube search for a form demonstration of this lift.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            Deliberately a search link, not a curated embed: with 1,324
            exercises there is no realistic way to keep one working video per
            lift, and a dead embed is worse than no embed. The `youtubeUrl`
            column stays for a future hand-picked set.
          */}
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
              `${exercise.name} form`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-2 px-4")}
          >
            <Play aria-hidden className="size-4" />
            Watch on YouTube
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </CardContent>
      </Card>

      {inProgress === null ? (
        <Link
          href="/workouts"
          className={cn(buttonVariants(), "h-12 w-full text-base")}
        >
          Start a workout
        </Link>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href={`/workouts/${inProgress.id}?exerciseId=${encodeURIComponent(
              exercise.datasetId,
            )}`}
            className={cn(buttonVariants(), "h-12 w-full text-base")}
          >
            Log in “{inProgress.name}”
          </Link>
          <p className="text-muted-foreground text-center text-xs">
            Opens your workout with this exercise filled in.
          </p>
        </div>
      )}

      <ScheduleExerciseButton
        datasetId={exercise.datasetId}
        today={today}
        defaultDate={tomorrow}
      />

      <Separator />

      <footer className="flex flex-col gap-1 pb-2">
        <p className="text-muted-foreground text-xs">
          {/* Verbatim, licence-bearing: do not reword or truncate. */}
          {exercise.attribution || GYM_VISUAL_ATTRIBUTION}
        </p>
        <p className="text-muted-foreground/80 text-xs">
          Exercise data from the Exercises Dataset (MIT). Media © Gym visual and
          not yet served by this build.
        </p>
      </footer>
    </div>
  );
}
