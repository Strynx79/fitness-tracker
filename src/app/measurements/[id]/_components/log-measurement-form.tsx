"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logMeasurement } from "@/app/measurements/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LogMeasurementFormProps = {
  typeId: string;
  unit: string;
  /** Today in the user's timezone; the default date. */
  today: string;
};

const LABEL = "text-sm font-medium";
const FIELD = "flex flex-col gap-2";

/**
 * Log (or correct) a reading for a given day.
 *
 * The date is editable and defaults to today: entering yesterday's waist at
 * breakfast is normal, and the action upserts on `(type, date)`, so re-submitting
 * the same day corrects it instead of duplicating it. Two 40px controls and one
 * filled button — the panel fits a one-third column on desktop and a thumb on
 * the phone.
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
    <section
      id="entry"
      aria-labelledby="log-reading-heading"
      className="bg-card flex scroll-mt-6 flex-col rounded-lg p-5 sm:p-6 lg:scroll-mt-20"
    >
      <h2 id="log-reading-heading" className="text-base font-medium">
        Log a reading
      </h2>
      <p className="text-muted-foreground mt-1 text-[13px]">
        Re-entering a date you already logged corrects that day.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div className={FIELD}>
          <label htmlFor="measurement-date" className={LABEL}>
            Date
          </label>
          <Input
            id="measurement-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="bg-card h-10 rounded-md text-base"
          />
        </div>

        <div className={FIELD}>
          <label htmlFor="measurement-value" className={LABEL}>
            Value ({unit})
          </label>
          <Input
            id="measurement-value"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="82.5"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="bg-card h-10 rounded-md font-mono text-base tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={pending || date === "" || value.trim() === ""}
              className="h-11 w-full rounded-md px-4 text-sm sm:w-auto"
            >
              {pending ? "Saving…" : "Save reading"}
            </Button>
          </div>

          {error === null ? null : (
            <p role="alert" className="text-negative text-[13px]">
              {error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
