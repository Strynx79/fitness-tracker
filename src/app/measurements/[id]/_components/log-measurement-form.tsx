"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logMeasurement } from "@/app/measurements/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LogMeasurementFormProps = {
  typeId: string;
  unit: string;
  /** Today in the user's timezone; the default date. */
  today: string;
};

/**
 * Log (or correct) a reading for a given day.
 *
 * The date is editable and defaults to today: entering yesterday's waist at
 * breakfast is normal, and the action upserts on `(type, date)`, so re-submitting
 * the same day corrects it instead of duplicating it.
 */
export function LogMeasurementForm({
  typeId,
  unit,
  today,
}: LogMeasurementFormProps) {
  const router = useRouter();

  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await logMeasurement({ typeId, date, value });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setValue("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a reading</CardTitle>
        <CardDescription>
          Re-entering a date you already logged corrects that day.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="measurement-date">Date</FieldLabel>
              <Input
                id="measurement-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 text-base"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="measurement-value">
                Value ({unit})
              </FieldLabel>
              <Input
                id="measurement-value"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="82.5"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-11 text-base tabular-nums"
              />
            </Field>
          </div>

          {error === null ? null : (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending || date === "" || value.trim() === ""}
            className="h-11 w-full"
          >
            {pending ? "Saving…" : "Save reading"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
