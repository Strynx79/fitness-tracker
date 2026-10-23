"use client";

import { useActionState } from "react";

import { createRoutine, type RoutineActionState } from "@/app/routines/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_STATE: RoutineActionState = { status: "idle" };

/** `FieldError` wants `{ message }` objects; the action hands back plain strings. */
function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Create a routine by name only.
 *
 * The exercises and the weekly schedule are edited on the routine's own page —
 * asking for them here would turn a one-field form into a wizard. Validation
 * stays on the server; this component only renders what `createRoutine` returns.
 */
export function NewRoutineForm() {
  const [state, formAction, pending] = useActionState(
    createRoutine,
    INITIAL_STATE,
  );

  const values = state.values ?? { name: "", notes: "" };
  const nameInvalid = Boolean(state.fieldErrors?.name?.length);
  const notesInvalid = Boolean(state.fieldErrors?.notes?.length);

  return (
    <section
      aria-labelledby="new-routine-heading"
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <h2 id="new-routine-heading" className="text-base leading-snug font-medium">
        New routine
      </h2>
      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
        A plan you can start any day — Push, Pull, Legs, Upper, Lower.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="routine-name">Name</FieldLabel>
          <Input
            id="routine-name"
            name="name"
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Push"
            defaultValue={values.name}
            aria-invalid={nameInvalid}
            className="bg-card h-10 rounded-md px-3 text-sm"
          />
          <FieldError
            errors={toFieldErrors(state.fieldErrors?.name)}
            className="text-negative text-[13px]"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="routine-notes">
            Notes
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </FieldLabel>
          <Textarea
            id="routine-notes"
            name="notes"
            rows={2}
            placeholder="Chest, shoulders, triceps"
            defaultValue={values.notes}
            aria-invalid={notesInvalid}
            className="bg-card min-h-[72px] rounded-md px-3 py-2 text-sm"
          />
          <FieldError
            errors={toFieldErrors(state.fieldErrors?.notes)}
            className="text-negative text-[13px]"
          />
        </Field>

        {state.status === "error" && state.message ? (
          <p
            role="status"
            aria-live="polite"
            className="text-negative text-[13px] leading-snug"
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md px-4 text-sm"
          >
            {pending ? "Creating…" : "Create routine"}
          </Button>
        </div>
      </form>
    </section>
  );
}
