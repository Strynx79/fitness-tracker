"use client";

import { useActionState } from "react";

import {
  createMeasurementType,
  type MeasurementFormState,
} from "@/app/measurements/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const INITIAL_STATE: MeasurementFormState = { status: "idle" };

const LABEL = "text-sm font-medium";
const FIELD = "flex flex-col gap-2";

/**
 * Validation copy, once, in the one place it is rendered.
 *
 * The server action returns plain strings; a Set drops duplicates so a field
 * with two messages does not repeat itself.
 */
function ValidationMessages({ messages }: { messages?: string[] }) {
  if (messages === undefined || messages.length === 0) return null;

  return (
    <div role="alert" className="text-negative text-[13px] leading-snug">
      {[...new Set(messages)].map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
  );
}

/**
 * Add a measurement the user cares about.
 *
 * There is no fixed body-part list: "Waist", "Chest", "Left arm", "Neck" are
 * just a name and a unit, and the trend works the same for each. This is the
 * screen's one filled action, so it sits at the panel's bottom right behind an
 * ordinary 40px field pair.
 */
export function NewMeasurementForm() {
  const [state, formAction, pending] = useActionState(
    createMeasurementType,
    INITIAL_STATE,
  );

  const values = state.values;
  const nameInvalid = Boolean(state.fieldErrors?.name?.length);
  const unitInvalid = Boolean(state.fieldErrors?.unit?.length);

  return (
    <section
      aria-labelledby="new-measurement-heading"
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <h2 id="new-measurement-heading" className="text-base font-medium">
        Track a measurement
      </h2>
      <p className="text-muted-foreground mt-1 text-[13px]">
        Waist, chest, arm — as many or as few as you like.
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className={FIELD}>
            <label htmlFor="measurement-name" className={LABEL}>
              Name
            </label>
            <Input
              // Keyed by the echoed value: the input is uncontrolled, so a
              // successful submit has to remount it empty rather than keep the
              // name that is now a row in the table above.
              key={`name-${values?.name ?? ""}`}
              id="measurement-name"
              name="name"
              type="text"
              placeholder="Waist"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              defaultValue={values?.name}
              aria-invalid={nameInvalid}
              className="bg-card h-10 rounded-md text-base"
            />
            <ValidationMessages messages={state.fieldErrors?.name} />
          </div>

          <div className={FIELD}>
            <label htmlFor="measurement-unit" className={LABEL}>
              Unit
            </label>
            <Input
              key={`unit-${values?.unit ?? ""}`}
              id="measurement-unit"
              name="unit"
              type="text"
              placeholder="cm"
              autoComplete="off"
              enterKeyHint="done"
              defaultValue={values?.unit}
              aria-invalid={unitInvalid}
              className="bg-card h-10 rounded-md text-base"
            />
            <ValidationMessages messages={state.fieldErrors?.unit} />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-md px-4 text-sm sm:w-auto"
            >
              {pending ? "Adding…" : "Add measurement"}
            </Button>
          </div>

          {/*
            The single announcement for both outcomes. Nothing else here may
            join the accessibility tree as a second live region, or the message
            gets read out twice.
          */}
          {state.status === "idle" || !state.message ? null : (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "text-[13px]",
                state.status === "error"
                  ? "text-negative"
                  : "text-muted-foreground",
              )}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
