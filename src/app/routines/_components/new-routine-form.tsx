"use client";

import { useActionState } from "react";

import { createRoutine, type RoutineActionState } from "@/app/routines/actions";
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

const INITIAL_STATE: RoutineActionState = { status: "idle" };

function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Create a routine by name only.
 *
 * The exercises and the weekly schedule are edited on the routine's own page —
 * asking for them here would turn a one-field form into a wizard.
 */
export function NewRoutineForm() {
  const [state, formAction, pending] = useActionState(createRoutine, INITIAL_STATE);

  const nameInvalid = Boolean(state.fieldErrors?.name?.length);
  const notesInvalid = Boolean(state.fieldErrors?.notes?.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New routine</CardTitle>
        <CardDescription>
          A plan you can start any day — Push, Pull, Legs, Upper, Lower.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Field data-invalid={nameInvalid}>
            <FieldLabel htmlFor="routine-name">Name</FieldLabel>
            <Input
              id="routine-name"
              name="name"
              type="text"
              placeholder="Push"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              defaultValue={state.values?.name}
              aria-invalid={nameInvalid}
              className="h-12 text-base"
            />
            <FieldError errors={toFieldErrors(state.fieldErrors?.name)} />
          </Field>

          <Field data-invalid={notesInvalid}>
            <FieldLabel htmlFor="routine-notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(opt)</span>
            </FieldLabel>
            <Textarea
              id="routine-notes"
              name="notes"
              rows={2}
              placeholder="Chest, shoulders, triceps"
              defaultValue={state.values?.notes}
              aria-invalid={notesInvalid}
            />
            <FieldError errors={toFieldErrors(state.fieldErrors?.notes)} />
          </Field>

          {state.status === "error" && state.message ? (
            <p role="status" aria-live="polite" className="text-destructive text-sm">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending} className="h-12 w-full text-base">
            {pending ? "Creating…" : "Create routine"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
