import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Play } from "lucide-react";

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
import { capitalizeExerciseName, extractYouTubeId } from "@/lib/exercise";
import { getExercise } from "@/lib/exercises";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getInProgressSession } from "@/lib/workouts";

/** Canonical attribution string; the media licence requires it verbatim. */
const MEDIA_ATTRIBUTION = "© Gym visual — https://gymvisual.com/";

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

  // Both reads are request-shaped and belong inside this boundary. The open
  // session decides whether the CTA can send the pick straight back to a workout
  // or has to start at the workouts page.
  const [exercise, inProgress] = await Promise.all([
    getExercise(datasetId),
    getInProgressSession(user.id),
  ]);

  // Missing and malformed are the same answer, so an id cannot be probed.
  if (exercise === null) notFound();

  const name = capitalizeExerciseName(exercise.name);
  const videoId = extractYouTubeId(exercise.youtubeUrl);

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
            {videoId === null
              ? "Search YouTube for a demonstration of this lift."
              : "Form demonstration from YouTube."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {videoId === null ? (
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
          ) : (
            <div className="bg-muted aspect-video w-full overflow-hidden rounded-lg border">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={`${name} demonstration`}
                className="size-full"
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}
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

      <Separator />

      <footer className="flex flex-col gap-1 pb-2">
        <p className="text-muted-foreground text-xs">
          {/* Verbatim, licence-bearing: do not reword or truncate. */}
          {exercise.attribution || MEDIA_ATTRIBUTION}
        </p>
        <p className="text-muted-foreground/80 text-xs">
          Exercise data from the Exercises Dataset (MIT). Media © Gym visual and
          not yet served by this build.
        </p>
      </footer>
    </div>
  );
}
