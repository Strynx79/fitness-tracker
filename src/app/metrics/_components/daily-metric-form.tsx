"use client";

import { useActionState } from "react";

import { saveDailyMetric, type SaveDailyMetricState } from "@/app/metrics/actions";
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

/** Server-fetched values for the selected day, already stringified for inputs. */
export type DailyMetricFormValues = {
  weightKg: string;
  calories: string;
  proteinG: string;
  notes: string;
};

type DailyMetricFormProps = {
  /** Chosen by the date nav, carried through a hidden input. */
  selectedDate: string;
  defaultValues: DailyMetricFormValues;
};

const INITIAL_STATE: SaveDailyMetricState = { status: "idle" };

/** `FieldError` wants `{ message }` objects; the action hands back plain strings. */
function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/**
 * Today's entry form.
 *
 * Validation runs once, on the server (`dailyMetricInputSchema`), so this
 * component only renders whatever `saveDailyMetric` returns — no duplicate
 * client-side rules to drift out of sync.
 */
export function DailyMetricForm({ selectedDate, defaultValues }: DailyMetricFormProps) {
  const [state, formAction, pending] = useActionState(saveDailyMetric, INITIAL_STATE);

  // After a failed submit, echo the user's own input back; otherwise fall back
  // to what the server has for this day.
  const values: DailyMetricFormValues = state.values ?? defaultValues;

  const weightInvalid = Boolean(state.fieldErrors?.weightKg?.length);
  const caloriesInvalid = Boolean(state.fieldErrors?.calories?.length);
  const proteinInvalid = Boolean(state.fieldErrors?.proteinG?.length);
  const notesInvalid = Boolean(state.fieldErrors?.notes?.length);
  const dateErrors = state.fieldErrors?.date;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily entry</CardTitle>
        <CardDescription>
          Leave a field blank to record it as unknown — different from a real 0.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="date" defaultValue={selectedDate} />

          {/*
            The date input lives in `MetricsDateNav`, a different form, so this
            error can never be attached to the input it belongs to. Surface it as
            a summary at the top of the form instead of burying it beside the
            hidden field, where it would read as an unexplained error.
          */}
          {dateErrors?.length ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <FieldError errors={toFieldErrors(dateErrors)} />
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-3">
            <Field data-invalid={weightInvalid}>
              <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
              <Input
                id="weightKg"
                name="weightKg"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="80.5"
                defaultValue={values.weightKg}
                aria-invalid={weightInvalid}
                className="h-11 text-base"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.weightKg)} />
            </Field>

            <Field data-invalid={caloriesInvalid}>
              <FieldLabel htmlFor="calories">Calories</FieldLabel>
              <Input
                id="calories"
                name="calories"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="2100"
                defaultValue={values.calories}
                aria-invalid={caloriesInvalid}
                className="h-11 text-base"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.calories)} />
            </Field>

            <Field data-invalid={proteinInvalid}>
              <FieldLabel htmlFor="proteinG">Protein (g)</FieldLabel>
              <Input
                id="proteinG"
                name="proteinG"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="160"
                defaultValue={values.proteinG}
                aria-invalid={proteinInvalid}
                className="h-11 text-base"
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.proteinG)} />
            </Field>
          </div>

          <Field data-invalid={notesInvalid}>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Sleep, energy, anything worth remembering."
              defaultValue={values.notes}
              aria-invalid={notesInvalid}
              className="min-h-24 text-base"
            />
            <FieldError errors={toFieldErrors(state.fieldErrors?.notes)} />
          </Field>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-11 w-full text-base"
            >
              {pending ? "Saving…" : "Save entry"}
            </Button>

            {/*
              The single announcement for both outcomes. Nothing else here may
              join the accessibility tree as a second live region, or the message
              gets read out twice. Rendering it inline also keeps it working with
              JS disabled, where the notification popover never appears.
            */}
            {state.status === "idle" || !state.message ? null : (
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "text-sm",
                  state.status === "error" ? "text-destructive" : "text-muted-foreground",
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
