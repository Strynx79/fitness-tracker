"use client";

import { useActionState } from "react";

import {
  createMeasurementType,
  type MeasurementFormState,
} from "@/app/measurements/actions";
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

const INITIAL_STATE: MeasurementFormState = { status: "idle" };

function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Add a measurement the user cares about.
 *
 * There is no fixed body-part list: "Waist", "Chest", "Left arm", "Neck" are all
 * just a name and a unit, and the trend chart works the same for each.
 */
export function NewMeasurementForm() {
  const [state, formAction, pending] = useActionState(
    createMeasurementType,
    INITIAL_STATE,
  );

  const nameInvalid = Boolean(state.fieldErrors?.name?.length);
  const unitInvalid = Boolean(state.fieldErrors?.unit?.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Track a measurement</CardTitle>
        <CardDescription>
          Waist, chest, arm — as many or as few as you like.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field data-invalid={nameInvalid}>
              <FieldLabel htmlFor="measurement-name">Name</FieldLabel>
              <Input
                id="measurement-name"
                name="name"
                type="text"
                placeholder="Waist"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                defaultValue={state.values?.name}
                aria-invalid={nameInvalid}
                className="h-12 text-base"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.name)} />
            </Field>

            <Field data-invalid={unitInvalid} className="w-24">
              <FieldLabel htmlFor="measurement-unit">Unit</FieldLabel>
              <Input
                id="measurement-unit"
                name="unit"
                type="text"
                placeholder="cm"
                autoComplete="off"
                enterKeyHint="done"
                defaultValue={state.values?.unit}
                aria-invalid={unitInvalid}
                className="h-12 text-base"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.unit)} />
            </Field>
          </div>

          {state.status === "error" && state.message ? (
            <p role="status" aria-live="polite" className="text-destructive text-sm">
              {state.message}
            </p>
          ) : null}

          {state.status === "success" && state.message ? (
            <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="h-12 w-full text-base">
            {pending ? "Adding…" : "Add measurement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
