"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { logSet, type WorkoutActionState } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LogSetFormProps = {
  sessionId: string;
  suggestions: Array<{ exerciseName: string; exerciseKey: string }>;
};

const INITIAL_STATE: WorkoutActionState = { status: "idle" };

/** `FieldError` wants `{ message }` objects; the action hands back plain strings. */
function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Log one set into an in-progress session.
 *
 * The exercise name is CONTROLLED and deliberately survives every submit: at
 * the gym the user logs 3–5 sets of the same lift in a row, and retyping (or
 * re-picking) the name each time is the difference between a flow and a chore.
 * The numeric inputs stay uncontrolled so React's automatic form reset clears
 * them after each successful save — ready for the next set with no reset code
 * and no stale weight left in the box.
 *
 * After a failed submit `state.values` re-fills the numbers the user typed, so
 * a rejected RPE does not make them re-enter the whole set.
 */
export function LogSetForm({ sessionId, suggestions }: LogSetFormProps) {
  const [state, formAction, pending] = useActionState(logSet, INITIAL_STATE);

  // Persisted on purpose across submissions — see the doc comment above. Seeded
  // from the echoed values so a failed no-JS submit (full reload) keeps the
  // name alongside the numeric fields restored by `defaultValue`.
  const [exerciseName, setExerciseName] = useState(
    () => state.values?.exerciseName ?? "",
  );
  const weightRef = useRef<HTMLInputElement>(null);

  // On a successful save the form has just reset; put the cursor straight back
  // into the weight box so the next set is one tap-pair away.
  useEffect(() => {
    if (state.status === "success") {
      weightRef.current?.focus();
    }
  }, [state]);

  const values = state.values ?? { exerciseName: "", weightKg: "", reps: "", rpe: "" };

  const exerciseInvalid = Boolean(state.fieldErrors?.exerciseName?.length);
  const weightInvalid = Boolean(state.fieldErrors?.weightKg?.length);
  const repsInvalid = Boolean(state.fieldErrors?.reps?.length);
  const rpeInvalid = Boolean(state.fieldErrors?.rpe?.length);

  // The action reuses the same copy in `message` and in `sessionId` for
  // "session not found / already finished". Show it once, anchored above the
  // fields, rather than as two announcements saying the same thing.
  const sessionError = state.fieldErrors?.sessionId?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a set</CardTitle>
        <CardDescription>
          The exercise name stays put, so you can go set after set.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="sessionId" defaultValue={sessionId} />

          {sessionError === undefined ? (
            state.status === "idle" || !state.message ? null : (
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "text-sm",
                  state.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {state.message}
              </p>
            )
          ) : (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p
                role="status"
                aria-live="polite"
                className="text-destructive text-sm"
              >
                {sessionError}
              </p>
            </div>
          )}

          <Field data-invalid={exerciseInvalid}>
            <FieldLabel htmlFor="exercise-name">Exercise</FieldLabel>
            <Input
              id="exercise-name"
              name="exerciseName"
              type="text"
              list="exercise-name-suggestions"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder="Bench Press"
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
              aria-invalid={exerciseInvalid}
              className="h-12 text-base"
            />
            <datalist id="exercise-name-suggestions">
              {suggestions.map((suggestion) => (
                <option
                  key={suggestion.exerciseKey}
                  value={suggestion.exerciseName}
                />
              ))}
            </datalist>
            <FieldError errors={toFieldErrors(state.fieldErrors?.exerciseName)} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field data-invalid={weightInvalid}>
              <FieldLabel htmlFor="weight-kg">Weight (kg)</FieldLabel>
              <Input
                ref={weightRef}
                id="weight-kg"
                name="weightKg"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                placeholder="90"
                defaultValue={values.weightKg}
                aria-invalid={weightInvalid}
                className="h-12 text-base tabular-nums"
              />
              <FieldDescription>0 = bodyweight</FieldDescription>
              <FieldError errors={toFieldErrors(state.fieldErrors?.weightKg)} />
            </Field>

            <Field data-invalid={repsInvalid}>
              <FieldLabel htmlFor="reps">Reps</FieldLabel>
              <Input
                id="reps"
                name="reps"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                placeholder="5"
                defaultValue={values.reps}
                aria-invalid={repsInvalid}
                className="h-12 text-base tabular-nums"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.reps)} />
            </Field>

            <Field data-invalid={rpeInvalid}>
              <FieldLabel htmlFor="rpe">
                RPE
                <span className="text-muted-foreground font-normal">
                  (opt)
                </span>
              </FieldLabel>
              <Input
                id="rpe"
                name="rpe"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="—"
                defaultValue={values.rpe}
                aria-invalid={rpeInvalid}
                className="h-12 text-base tabular-nums"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.rpe)} />
            </Field>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="h-12 w-full text-base"
          >
            {pending ? "Saving…" : "Log set"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
