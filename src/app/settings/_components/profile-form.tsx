"use client";

import { useActionState } from "react";

import { updateProfile, type ProfileActionState } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProfileFormProps = {
  /** Currently saved IANA zone, already validated by the server. */
  timezone: string;
  /** `null` means "no goal" and is shown as an empty input. */
  goalWeightKg: number | null;
  /** Canonical zones plus the user's own value when it is an alias. */
  timezones: string[];
};

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
 * Profile settings.
 *
 * Validation runs once, on the server (`profileSchema`), so this component only
 * renders whatever `updateProfile` returns. Fields stay uncontrolled: the
 * browser keeps whatever the user typed after a failed submit, and the
 * no-JS response is re-rendered from `state.values`.
 */
export function ProfileForm({
  timezone,
  goalWeightKg,
  timezones,
}: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, INITIAL_STATE);

  // After a failed submit, echo the user's own input back; otherwise fall back
  // to what the server currently has.
  const values = state.values ?? {
    timezone,
    goalWeightKg: toInputValue(goalWeightKg),
  };

  const timezoneInvalid = Boolean(state.fieldErrors?.timezone?.length);
  const goalInvalid = Boolean(state.fieldErrors?.goalWeightKg?.length);

  // `FieldError` renders nothing unless the field actually failed, so only
  // reference its id in that case — a dangling id confuses screen readers.
  const timezoneDescribedBy = timezoneInvalid
    ? "timezone-description timezone-error"
    : "timezone-description";
  const goalDescribedBy = goalInvalid
    ? "goalWeightKg-description goalWeightKg-error"
    : "goalWeightKg-description";

  // A rejected zone can only come from a hand-crafted no-JS POST — the native
  // select offers valid options only. Keep it in the list so the error is shown
  // beside the value the user actually sent instead of silently selecting the
  // first zone. Blanks are ignored; the schema already rejects them.
  const timezoneOptions =
    values.timezone.trim() !== "" && !timezones.includes(values.timezone)
      ? [values.timezone, ...timezones]
      : timezones;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          These two values are used for the dashboard, metrics, habits and
          workout times.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <Field data-invalid={timezoneInvalid}>
            <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
            {/*
              A native <select> on purpose: 400+ options are fine because the
              phone shows its own full-screen picker. A custom combobox would
              cost taps and break the no-JS path for no benefit.
            */}
            <select
              id="timezone"
              name="timezone"
              defaultValue={values.timezone}
              aria-invalid={timezoneInvalid}
              aria-describedby={timezoneDescribedBy}
              className={cn(
                "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
                "dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              )}
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <FieldDescription id="timezone-description">
              Changing this moves what counts as “today” for habits, metrics and
              the dashboard — a day logged late may shift by one calendar day.
            </FieldDescription>
            <FieldError
              id="timezone-error"
              errors={toFieldErrors(state.fieldErrors?.timezone)}
            />
          </Field>

          <Field data-invalid={goalInvalid}>
            <FieldLabel htmlFor="goalWeightKg">Goal weight (kg)</FieldLabel>
            <Input
              id="goalWeightKg"
              name="goalWeightKg"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="75"
              defaultValue={values.goalWeightKg}
              aria-invalid={goalInvalid}
              aria-describedby={goalDescribedBy}
              className="h-11 text-base"
            />
            <FieldDescription id="goalWeightKg-description">
              Optional. Leave it blank to remove your goal.
            </FieldDescription>
            <FieldError
              id="goalWeightKg-error"
              errors={toFieldErrors(state.fieldErrors?.goalWeightKg)}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-11 w-full text-base"
            >
              {pending ? "Saving…" : "Save settings"}
            </Button>

            {/*
              The single announcement for both outcomes. Rendering it inline
              (rather than a toast) also keeps it working with JS disabled.
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
