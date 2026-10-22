"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { logSet, type WorkoutActionState } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const INITIAL_STATE: WorkoutActionState = { status: "idle" };

type AddSetFormProps = {
  /** `WorkoutExercise.id` — the card this row belongs to. */
  blockId: string;
};

/**
 * The "next set" row at the bottom of an exercise card.
 *
 * Deliberately unlabelled inputs with placeholders and `aria-label`s instead of
 * the full `Field` stack: this row repeats once per exercise, and three labels
 * above every one of them would triple the height of the screen. The table
 * header above already names the columns.
 *
 * Numeric inputs stay uncontrolled so React's form reset clears them after a
 * successful save, while a FAILED submit re-fills them from `state.values` —
 * a rejected RPE should not make the user retype the weight.
 */
export function AddSetForm({ blockId }: AddSetFormProps) {
  const [state, formAction, pending] = useActionState(logSet, INITIAL_STATE);
  const weightRef = useRef<HTMLInputElement>(null);

  // After a save the form has just reset; put the cursor back in the weight box
  // so logging set after set is one tap-pair away.
  useEffect(() => {
    if (state.status === "success") {
      weightRef.current?.focus();
    }
  }, [state]);

  const error =
    state.status === "error"
      ? (state.fieldErrors?.weightKg?.[0] ??
        state.fieldErrors?.reps?.[0] ??
        state.fieldErrors?.rpe?.[0] ??
        state.fieldErrors?.sessionId?.[0] ??
        state.fieldErrors?.workoutExerciseId?.[0] ??
        state.message)
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="workoutExerciseId" value={blockId} />

      <div className="flex items-center gap-2">
        <Input
          ref={weightRef}
          name="weightKg"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          placeholder="kg"
          aria-label="Weight in kilograms"
          defaultValue={state.values?.weightKg}
          className="h-11 flex-1 text-base tabular-nums"
        />
        <Input
          name="reps"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          placeholder="reps"
          aria-label="Reps"
          defaultValue={state.values?.reps}
          className="h-11 flex-1 text-base tabular-nums"
        />
        <Input
          name="rpe"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="RPE"
          aria-label="RPE (optional)"
          defaultValue={state.values?.rpe}
          className="h-11 w-20 text-base tabular-nums"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0"
          disabled={pending}
          aria-label="Add set"
        >
          <Plus aria-hidden className="size-5" />
        </Button>
      </div>

      {error === undefined ? null : (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </form>
  );
}
