"use client";

import { useActionState } from "react";

import { updateProfile, type ProfileActionState } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const INITIAL_STATE: ProfileActionState = { status: "idle" };

/** `FieldError` wants `{ message }` objects; the action hands back plain strings. */
function toFieldErrors(errors: string[] | undefined) {
  return errors?.map((message) => ({ message }));
}

/** An untouched optional input submits "", which the schema reads as `null`. */
function toInputValue(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * The single announcement for one section's outcome.
 *
 * Rendered inline rather than as a toast, so it survives a no-JS submit. Each
 * form owns its own live region: only one section is ever submitted at a time,
 * so there is never a second message competing for the reader.
 */
function StatusMessage({ state }: { state: ProfileActionState }) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-[13px] leading-snug",
        state.status === "error" ? "text-negative" : "text-muted-foreground",
      )}
    >
      {state.message}
    </p>
  );
}

type GoalWeightFormProps = {
  /** Currently saved IANA zone — posted back unchanged with the goal. */
  timezone: string;
  /** `null` means "no goal" and is shown as an empty input. */
  goalWeightKg: number | null;
};

/**
 * The goal weight panel.
 *
 * `updateProfile` validates both profile fields at once, so this form carries
 * the saved timezone in a hidden input: saving one section can never clear the
 * other by omitting it. Validation still runs once, on the server, and fields
 * stay uncontrolled so a failed submit keeps what the user typed.
 */
export function GoalWeightForm({ timezone, goalWeightKg }: GoalWeightFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    INITIAL_STATE,
  );

  // After a failed submit, echo the user's own input back; otherwise fall back
  // to what the server currently has.
  const values = state.values ?? {
    timezone,
    goalWeightKg: toInputValue(goalWeightKg),
  };

  const invalid = Boolean(state.fieldErrors?.goalWeightKg?.length);

  // Only reference the error id when the field actually failed: a dangling id
  // confuses screen readers.
  const describedBy = invalid
    ? "goalWeightKg-description goalWeightKg-error"
    : "goalWeightKg-description";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="timezone" value={values.timezone} />

      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="goalWeightKg">Goal weight</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id="goalWeightKg"
            name="goalWeightKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="75"
            defaultValue={values.goalWeightKg}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="bg-card h-10 rounded-md px-3 text-sm"
          />
          <span className="text-muted-foreground text-xs">kg</span>
        </div>
        <p
          id="goalWeightKg-description"
          className="text-muted-foreground text-[13px] leading-snug"
        >
          Optional. Leave it blank to remove your goal.
        </p>
        <FieldError
          id="goalWeightKg-error"
          errors={toFieldErrors(state.fieldErrors?.goalWeightKg)}
          className="text-negative text-[13px]"
        />
      </Field>

      <StatusMessage state={state} />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-md px-4 text-sm"
        >
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

type TimezoneFormProps = {
  /** Currently saved IANA zone. */
  timezone: string;
  /** Posted back unchanged so saving the zone cannot clear the goal. */
  goalWeightKg: number | null;
  /** Canonical zones plus the user's own value when it is an alias. */
  timezones: string[];
};

/**
 * The time zone panel.
 *
 * Same save model as the goal panel: one form, one server action, one primary
 * at the bottom right. The goal weight rides along in a hidden input because
 * the shared schema always validates the whole profile.
 */
export function TimezoneForm({
  timezone,
  goalWeightKg,
  timezones,
}: TimezoneFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    INITIAL_STATE,
  );

  const values = state.values ?? {
    timezone,
    goalWeightKg: toInputValue(goalWeightKg),
  };

  const invalid = Boolean(state.fieldErrors?.timezone?.length);

  // A rejected zone can only come from a hand-crafted no-JS POST. Keep it in
  // the list so the error appears beside the value the user actually sent
  // instead of silently selecting the first zone. Blanks are ignored; the
  // schema already rejects them.
  const timezoneOptions =
    values.timezone.trim() !== "" && !timezones.includes(values.timezone)
      ? [values.timezone, ...timezones]
      : timezones;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="goalWeightKg" value={values.goalWeightKg} />

      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="timezone">Time zone</FieldLabel>
        {/*
          A native <select> on purpose: 400+ options are fine because the phone
          shows its own full-screen picker. A custom combobox would cost taps and
          break the no-JS path for no benefit.
        */}
        <select
          id="timezone"
          name="timezone"
          defaultValue={values.timezone}
          aria-invalid={invalid}
          aria-describedby={invalid ? "timezone-error" : undefined}
          className={cn(
            "bg-card border-input h-10 w-full min-w-0 rounded-md border px-3 text-sm transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
          )}
        >
          {timezoneOptions.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <FieldError
          id="timezone-error"
          errors={toFieldErrors(state.fieldErrors?.timezone)}
          className="text-negative text-[13px]"
        />
      </Field>

      <StatusMessage state={state} />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-md px-4 text-sm"
        >
          {pending ? "Saving…" : "Save time zone"}
        </Button>
      </div>
    </form>
  );
}
