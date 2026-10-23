"use client";

import { useActionState } from "react";

import { createSession, type WorkoutActionState } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The PRD's example splits, offered as completions without restricting input. */
const SESSION_NAME_SUGGESTIONS = ["Push", "Pull", "Legs", "Upper", "Lower"];

const INITIAL_STATE: WorkoutActionState = { status: "idle" };

/** `FieldError` wants `{ message }` objects; the action hands back plain strings. */
function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Start a session.
 *
 * Validation lives in `createSession` (and its Zod schema), so this component
 * only renders what comes back. On success the action redirects, which is why
 * there is no success state to show here.
 *
 * Inputs stay uncontrolled, matching the metrics and habits forms: React resets
 * the form when the action runs, then `defaultValue={values…}` refills it from
 * the echoed input on a failed submit. After a successful create the redirect
 * unmounts the form anyway.
 */
export function NewSessionForm() {
  const [state, formAction, pending] = useActionState(
    createSession,
    INITIAL_STATE,
  );

  const values = state.values ?? { name: "", notes: "" };
  const nameInvalid = Boolean(state.fieldErrors?.name?.length);
  const notesInvalid = Boolean(state.fieldErrors?.notes?.length);

  return (
    <section
      id="start-session"
      aria-labelledby="start-session-heading"
      className="bg-card scroll-mt-6 rounded-lg p-5 sm:p-6 lg:scroll-mt-20"
    >
      <h2
        id="start-session-heading"
        className="text-base leading-snug font-medium"
      >
        Start a workout
      </h2>
      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
        Name it and go. Sets are logged on the session screen.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="session-name">Session name</FieldLabel>
          <Input
            id="session-name"
            name="name"
            type="text"
            list="session-name-suggestions"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="Push"
            defaultValue={values.name}
            aria-invalid={nameInvalid}
            className="bg-card h-10 rounded-md px-3 text-sm"
          />
          <datalist id="session-name-suggestions">
            {SESSION_NAME_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <FieldError
            errors={toFieldErrors(state.fieldErrors?.name)}
            className="text-negative text-[13px]"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="session-notes">
            Notes
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </FieldLabel>
          <Textarea
            id="session-notes"
            name="notes"
            rows={2}
            placeholder="Sleep, energy, what you want to hit today."
            defaultValue={values.notes}
            aria-invalid={notesInvalid}
            className="bg-card min-h-20 rounded-md px-3 text-sm"
          />
          <FieldError
            errors={toFieldErrors(state.fieldErrors?.notes)}
            className="text-negative text-[13px]"
          />
        </Field>

        {/*
          The single announcement for both outcomes, exactly like the other
          slice forms: no toast, and nothing else in this form may become a
          second live region.
        */}
        {state.status === "idle" || !state.message ? null : (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "text-[13px] leading-snug",
              state.status === "error"
                ? "text-negative"
                : "text-muted-foreground",
            )}
          >
            {state.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md px-4 text-sm"
          >
            {pending ? "Starting…" : "Start workout"}
          </Button>
        </div>
      </form>
    </section>
  );
}
