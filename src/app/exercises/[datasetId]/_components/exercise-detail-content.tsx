import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/app/_components/back-link";
import { ScreenHeader } from "@/app/_components/page-shell";
import { ScheduleExerciseButton } from "@/app/exercises/[datasetId]/_components/schedule-exercise-button";
import { buttonVariants } from "@/components/ui/button";
import { capitalizeExerciseName } from "@/lib/exercise";
import {
  GYM_VISUAL_ATTRIBUTION,
  exerciseMediaUrl,
} from "@/lib/exercise-media";
import { getExercise } from "@/lib/exercises";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/date";
import { cn } from "@/lib/utils";
import { getInProgressSession } from "@/lib/workouts";

type ExerciseDetailContentProps = {
  params: PageProps<"/exercises/[datasetId]">["params"];
};

/**
 * "Body part · Equipment · Target", the three facts that identify a movement.
 *
 * The middle dot is the same separator the library's phone sublines use.
 */
function describeExercise(exercise: {
  bodyPart: string;
  equipment: string;
  target: string;
}): string {
  return [
    capitalizeExerciseName(exercise.bodyPart),
    capitalizeExerciseName(exercise.equipment),
    capitalizeExerciseName(exercise.target),
  ].join(" · ");
}

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
  // `secondary_muscles` ("abs" often appears in all three). The Secondary row
  // lists each remaining muscle once, never the target it supports.
  const secondaryMuscles = exercise.secondaryMuscles
    .map((muscle) => muscle.trim())
    .filter((muscle, index, all) => {
      if (muscle === "") return false;

      const key = muscle.toLowerCase();
      const firstIndex = all.findIndex(
        (other) => other.toLowerCase() === key,
      );

      return (
        firstIndex === index &&
        key !== exercise.target.trim().toLowerCase() &&
        key !== (exercise.muscleGroup ?? "").trim().toLowerCase()
      );
    });

  const metaRows = [
    {
      label: "Body part",
      value: capitalizeExerciseName(exercise.bodyPart),
    },
    {
      label: "Equipment",
      value: capitalizeExerciseName(exercise.equipment),
    },
    {
      label: "Target",
      value: capitalizeExerciseName(exercise.target),
    },
    {
      label: "Secondary",
      value:
        secondaryMuscles.length === 0
          ? "—"
          : secondaryMuscles.map(capitalizeExerciseName).join(", "),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink
          href="/exercises"
          label="Library"
          className="-ml-2 h-10 px-2 text-[13px]"
        />

        <ScreenHeader
          title={name}
          description={describeExercise(exercise)}
          action={
            <ScheduleExerciseButton
              datasetId={exercise.datasetId}
              today={today}
              // "Schedule for today" opens on today's date; a later day is one
              // pick away in the dialog's own date field.
              defaultDate={today}
            />
          }
        />
      </div>

      <div className="flex flex-col gap-6">
        {gifUrl === null ? null : (
          <figure className="flex flex-col items-start gap-2">
            {/*
              A plain <img>, not next/image: this is a 180×180 animated GIF, the
              optimizer would need remotePatterns for the dataset host and adds
              nothing at this size. Hotlinked on purpose — the media is © Gym
              visual and is not vendored into this repository. The source stays
              180px; the rendered box is smaller on a phone.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gifUrl}
              alt={`${name} demonstration`}
              width={180}
              height={180}
              loading="lazy"
              className="bg-card size-32 rounded object-contain sm:size-40 lg:size-[180px]"
            />
            <figcaption className="text-muted-foreground text-[11px] leading-snug">
              {GYM_VISUAL_ATTRIBUTION}
            </figcaption>
          </figure>
        )}

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Exercise details</caption>
          <tbody className="divide-rule divide-y">
            {metaRows.map((row) => (
              <tr key={row.label} className="h-10">
                <th scope="row" className="text-left text-sm font-normal">
                  {row.label}
                </th>
                <td className="text-foreground pl-4 text-right text-[13px]">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section
          aria-labelledby="how-to-do-it"
          className="flex flex-col gap-3"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="how-to-do-it" className="text-base leading-snug font-medium">
              How to do it
            </h2>
            {exercise.stepsEn.length === 0 ? null : (
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                {exercise.stepsEn.length} steps
              </p>
            )}
          </div>

          {exercise.stepsEn.length === 0 ? (
            <p className="max-w-[62ch] text-[15px] leading-[1.6]">
              {exercise.instructionsEn}
            </p>
          ) : (
            <ol className="marker:text-muted-foreground max-w-[62ch] list-decimal pl-5 text-[15px] leading-[1.6] marker:font-mono marker:text-xs">
              {exercise.stepsEn.map((step, index) => (
                <li
                  key={`${index}-${step.slice(0, 24)}`}
                  className="pl-1.5"
                >
                  {step}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          {inProgress === null ? (
            <Link
              href="/workouts"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "bg-card h-11 rounded-md px-4 text-sm",
              )}
            >
              Start a workout
            </Link>
          ) : (
            <div className="flex flex-col gap-1">
              <Link
                href={`/workouts/${inProgress.id}?exerciseId=${encodeURIComponent(
                  exercise.datasetId,
                )}`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "bg-card h-11 rounded-md px-4 text-sm",
                )}
              >
                Log in “{inProgress.name}”
              </Link>
              <p className="text-muted-foreground text-[13px] leading-snug">
                Opens your workout with this exercise filled in.
              </p>
            </div>
          )}

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
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-10 items-center rounded-md text-sm font-medium underline underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Watch on YouTube
          </a>
        </div>

        <footer className="border-rule flex flex-col gap-1 border-t pt-4 pb-2">
          <p className="text-muted-foreground text-[11px] leading-snug">
            {/* Verbatim, licence-bearing: do not reword or truncate. */}
            {exercise.attribution || GYM_VISUAL_ATTRIBUTION}
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Exercise data from the Exercises Dataset (MIT). Media © Gym visual
            and not yet served by this build.
          </p>
        </footer>
      </div>
    </>
  );
}
