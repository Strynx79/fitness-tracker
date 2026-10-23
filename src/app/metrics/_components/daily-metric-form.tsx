"use client";

import { useActionState } from "react";

import { saveDailyMetric, type SaveDailyMetricState } from "@/app/metrics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseIsoDate } from "@/lib/date";
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
  /** The user's calendar day, so the panel can say "Today" honestly. */
  today: string;
  defaultValues: DailyMetricFormValues;
};

const INITIAL_STATE: SaveDailyMetricState = { status: "idle" };

const DAY_MONTH = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatEntryDay(selectedDate: string, today: string): string {
  return selectedDate === today
    ? "Today"
    : DAY_MONTH.format(parseIsoDate(selectedDate));
}

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

const LABEL = "text-sm font-medium";
const FIELD = "flex flex-col gap-2";

/**
 * The day's entry form.
 *
 * Validation still runs once, on the server (`dailyMetricInputSchema`), so this
 * component renders whatever `saveDailyMetric` returns and keeps no duplicate
 * client-side rules. Presentation is gym-first: 40px controls, decimal keypad
 * for the weight, and one near-black save button — the only filled button on
 * the screen.
 */
export function DailyMetricForm({
  selectedDate,
  today,
  defaultValues,
}: DailyMetricFormProps) {
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
    <section
      id="entry"
      aria-labelledby="daily-entry-heading"
      className="bg-card flex scroll-mt-6 flex-col rounded-lg p-5 sm:p-6 lg:scroll-mt-20"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="daily-entry-heading" className="text-base font-medium">
          Daily entry
        </h2>
        <time
          dateTime={selectedDate}
          className="text-muted-foreground text-xs tabular-nums"
        >
          {formatEntryDay(selectedDate, today)}
        </time>
      </div>

      <p className="text-muted-foreground mt-1 text-[13px]">
        Leave a field blank to record it as unknown.
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="date" defaultValue={selectedDate} />

        {/*
          The date input lives in `MetricsDateNav`, a different form, so this
          error can never be attached to the input it belongs to. Surface it as
          a summary at the top of the form instead of burying it beside the
          hidden field.
        */}
        {dateErrors?.length ? <ValidationMessages messages={dateErrors} /> : null}

        <div className={FIELD}>
          <label htmlFor="weightKg" className={LABEL}>
            Weight (kg)
          </label>
          <Input
            id="weightKg"
            name="weightKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={values.weightKg}
            aria-invalid={weightInvalid}
            className="bg-card h-10 rounded-md font-mono text-base tabular-nums"
          />
          <ValidationMessages messages={state.fieldErrors?.weightKg} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={FIELD}>
            <label htmlFor="calories" className={LABEL}>
              Calories
            </label>
            <Input
              id="calories"
              name="calories"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={values.calories}
              aria-invalid={caloriesInvalid}
              className="bg-card h-10 rounded-md font-mono text-base tabular-nums"
            />
            <ValidationMessages messages={state.fieldErrors?.calories} />
          </div>

          <div className={FIELD}>
            <label htmlFor="proteinG" className={LABEL}>
              Protein (g)
            </label>
            <Input
              id="proteinG"
              name="proteinG"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={values.proteinG}
              aria-invalid={proteinInvalid}
              className="bg-card h-10 rounded-md font-mono text-base tabular-nums"
            />
            <ValidationMessages messages={state.fieldErrors?.proteinG} />
          </div>
        </div>

        <div className={FIELD}>
          <label htmlFor="notes" className={LABEL}>
            Notes
          </label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Sleep, energy, anything worth remembering."
            defaultValue={values.notes}
            aria-invalid={notesInvalid}
            className="bg-card min-h-20 rounded-md text-base"
          />
          <ValidationMessages messages={state.fieldErrors?.notes} />
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-md px-4 text-sm sm:w-auto"
            >
              {pending ? "Saving…" : "Save entry"}
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
                state.status === "error" ? "text-negative" : "text-muted-foreground",
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
