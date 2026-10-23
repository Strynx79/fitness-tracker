"use client";

import { useActionState } from "react";

import { createHabit, type HabitActionState } from "@/app/habits/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const INITIAL_STATE: HabitActionState = { status: "idle" };

/** `FieldError` wants `{ message }` objects; the action hands back plain strings. */
function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Add a habit.
 *
 * Validation runs once, on the server (`createHabitSchema`), so this component
 * only renders whatever `createHabit` returns — no second set of rules to drift
 * out of sync with the schema.
 *
 * The inputs stay uncontrolled on purpose. React resets a form's fields every
 * time its `action` runs, so after a failed submit React clears them and
 * `defaultValue={values…}` immediately refills them with the echoed input; after
 * a successful create `state.values` is absent, so the same reset leaves the
 * fields empty for the next habit. No reset code, and no key to babysit.
 */
export function NewHabitForm() {
  const [state, formAction, pending] = useActionState(createHabit, INITIAL_STATE);

  const values = state.values ?? { name: "", description: "" };
  const nameInvalid = Boolean(state.fieldErrors?.name?.length);
  const descriptionInvalid = Boolean(state.fieldErrors?.description?.length);

  return (
    <section
      aria-labelledby="add-habit-heading"
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <h2 id="add-habit-heading" className="text-base leading-snug font-medium">
        Add a habit
      </h2>
      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
        One line, ticked daily. Small enough that you&apos;d never skip it.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="habit-name">Habit name</FieldLabel>
          <Input
            id="habit-name"
            name="name"
            type="text"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="Read 20m"
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
          <FieldLabel htmlFor="habit-description">
            Why it matters
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </FieldLabel>
          <Input
            id="habit-description"
            name="description"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Twenty minutes of a book, not a feed."
            defaultValue={values.description}
            aria-invalid={descriptionInvalid}
            className="bg-card h-10 rounded-md px-3 text-sm"
          />
          <FieldError
            errors={toFieldErrors(state.fieldErrors?.description)}
            className="text-negative text-[13px]"
          />
        </Field>

        {/*
          The single announcement for both outcomes. Nothing else here may join
          the accessibility tree as a second live region, or the message gets
          read out twice. Rendering it inline also keeps it working with JS
          disabled, where the notification popover never appears.
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
            {pending ? "Adding…" : "Add habit"}
          </Button>
        </div>
      </form>
    </section>
  );
}
