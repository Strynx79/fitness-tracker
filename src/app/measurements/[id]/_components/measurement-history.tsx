"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteMeasurementEntry,
  deleteMeasurementType,
} from "@/app/measurements/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MeasurementPoint } from "@/lib/measurements";
import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/workout-format";

import {
  formatChange,
  formatDateLabel,
  formatValue,
  roundTenths,
} from "@/app/measurements/_components/measurement-format";

type MeasurementHistoryProps = {
  /** Ascending by date, as returned by `getMeasurement`. */
  points: MeasurementPoint[];
  unit: string;
  /** The user's calendar day, for "Today"/"Yesterday". */
  today: string;
};

/**
 * Each reading's change against the one before it.
 *
 * `points` is ascending, so the first pass carries each value forward; the
 * returned rows are reversed for display (newest first) because the reading you
 * just logged belongs at the top. The oldest row has nothing older to compare
 * with, so its change stays `null` and prints as an em dash — never a zero.
 */
function withChanges(
  points: MeasurementPoint[],
): Array<{ point: MeasurementPoint; change: number | null }> {
  const changeByEntry = new Map<string, number>();

  for (let index = 1; index < points.length; index += 1) {
    changeByEntry.set(
      points[index].id,
      roundTenths(points[index].value - points[index - 1].value),
    );
  }

  return [...points].reverse().map((point) => ({
    point,
    change: changeByEntry.get(point.id) ?? null,
  }));
}

/** A real em dash for a missing comparison. */
function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The readings as a ruled ledger, newest first.
 *
 * No zebra, no fill band, no pagination: the date is the identity column, the
 * figures are right-aligned mono, and the only row action is a quiet text
 * delete in a fixed trailing column. The column is fixed so the dates and the
 * values do not shift between rows that have an action and the header row.
 */
export function MeasurementHistory({
  points,
  unit,
  today,
}: MeasurementHistoryProps) {
  const rows = withChanges(points);

  return (
    <section
      aria-labelledby="measurement-history-heading"
      className="bg-card rounded-lg p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="measurement-history-heading"
          className="text-base font-medium"
        >
          History
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {points.length === 0
            ? "No readings"
            : `${points.length} reading${points.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">No readings yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-rule text-muted-foreground border-b text-xs">
                <th scope="col" className="py-2 pr-4 text-left font-normal">
                  Date
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 pl-4 text-right font-normal whitespace-nowrap"
                >
                  Value
                </th>
                <th
                  scope="col"
                  className="py-2 pr-4 pl-4 text-right font-normal whitespace-nowrap"
                >
                  Change
                </th>
                <th
                  scope="col"
                  className="w-20 py-2 pl-4 text-right font-normal whitespace-nowrap"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-rule divide-y">
              {rows.map(({ point, change }) => {
                const { label, isIso } = formatDateLabel(point.date, today);

                return (
                  <tr key={point.id} className="h-12">
                    <td className="pr-4 align-middle">
                      <time
                        dateTime={point.date}
                        className={cn(isIso && "font-mono tabular-nums")}
                      >
                        {label}
                      </time>
                    </td>

                    <td className="pr-4 pl-4 text-right align-middle whitespace-nowrap">
                      <span className="font-mono tabular-nums">
                        {formatValue(point.value)}
                      </span>
                      <span className="text-muted-foreground ml-1 text-xs">
                        {unit}
                      </span>
                    </td>

                    <td className="pr-4 pl-4 text-right align-middle whitespace-nowrap">
                      {change === null ? (
                        <Missing label="No earlier reading" />
                      ) : (
                        <span className="inline-flex items-baseline justify-end gap-1">
                          <span
                            className={cn(
                              "font-mono tabular-nums",
                              change > 0 && "text-positive",
                              change < 0 && "text-negative",
                              change === 0 && "text-muted-foreground",
                            )}
                          >
                            {formatChange(change)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {unit}
                          </span>
                        </span>
                      )}
                    </td>

                    <td className="w-20 pl-4 text-right align-middle">
                      <DeleteReadingButton
                        entryId={point.id}
                        date={point.date}
                        value={point.value}
                        unit={unit}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DeleteReadingButton({
  entryId,
  date,
  value,
  unit,
}: {
  entryId: string;
  date: string;
  value: number;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteMeasurementEntry(entryId);
      if (result.ok) {
        setOpen(false);
        return;
      }
      setError(result.message);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger
        aria-label={`Delete reading from ${formatCalendarDate(date)}`}
        render={
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-negative focus-visible:ring-ring/50 h-9 rounded-md px-2 text-[13px] font-normal hover:bg-transparent"
          />
        }
      >
        Delete
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this reading?</DialogTitle>
          <DialogDescription>
            {formatCalendarDate(date)} ·{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatValue(value)} {unit}
            </span>
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-negative text-[13px]">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            render={<Button variant="ghost" size="lg" className="h-11" />}
          >
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            className="h-11"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Archive the whole measurement.
 *
 * Kept separate from the per-reading delete because it is a different intent:
 * "stop tracking waist" vs "that entry was a typo". A quiet text action, not a
 * filled button — nothing on this screen competes with "Log a reading".
 */
export function DeleteMeasurementTypeButton({ typeId }: { typeId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteMeasurementType(typeId);
      if (result.ok) {
        setOpen(false);
        // The type no longer exists, so the detail route is gone; go back to the
        // list rather than leaving a dead page behind.
        router.push("/measurements");
        return;
      }
      setError(result.message);
    });
  }

  return (
    <div className="flex justify-start">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-negative focus-visible:ring-ring/50 h-9 rounded-md px-2 text-[13px] font-normal hover:bg-transparent"
            />
          }
        >
          Stop tracking this measurement
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop tracking this measurement?</DialogTitle>
            <DialogDescription>
              It disappears from your list. Its readings are kept in the
              database, so nothing is lost if you want it back later.
            </DialogDescription>
          </DialogHeader>

          {error === null ? null : (
            <p role="alert" className="text-negative text-[13px]">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost" size="lg" className="h-11" />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              size="lg"
              className="h-11"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? "Removing…" : "Stop tracking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
