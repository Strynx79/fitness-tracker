"use client";

import { useActionState } from "react";

import { createSession, type WorkoutActionState } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Start a workout</CardTitle>
        <CardDescription>
          Name it and go. Sets are logged on the session screen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <Field data-invalid={nameInvalid}>
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
              className="h-12 text-base"
            />
            <datalist id="session-name-suggestions">
              {SESSION_NAME_SUGGESTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <FieldError errors={toFieldErrors(state.fieldErrors?.name)} />
          </Field>

          <Field data-invalid={notesInvalid}>
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
              className="min-h-20 text-base"
            />
            <FieldError errors={toFieldErrors(state.fieldErrors?.notes)} />
          </Field>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-12 w-full text-base"
            >
              {pending ? "Starting…" : "Start workout"}
            </Button>

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
                  "text-sm",
                  state.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {state.message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
