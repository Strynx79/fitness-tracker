"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MeasurementPoint } from "@/lib/measurements";
import { formatCalendarDate } from "@/lib/workout-format";

type MeasurementHistoryProps = {
  points: MeasurementPoint[];
  unit: string;
};

/** Newest first — the reading you just logged should be at the top. */
export function MeasurementHistory({ points, unit }: MeasurementHistoryProps) {
  if (points.length === 0) return null;

  const descending = [...points].reverse();

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-0">Date</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="w-12 pr-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {descending.map((point) => (
            <TableRow key={point.date} className="h-12">
              <TableCell className="pl-0">
                {formatCalendarDate(point.date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {point.value} {unit}
              </TableCell>
              <TableCell className="pr-0 text-right">
                <DeleteReadingButton
                  entryId={point.id}
                  date={point.date}
                  value={point.value}
                  unit={unit}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
            size="icon"
            className="text-muted-foreground/60 hover:text-destructive -mr-2 size-11"
          />
        }
      >
        <Trash2 aria-hidden />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this reading?</DialogTitle>
          <DialogDescription>
            {formatCalendarDate(date)} ·{" "}
            <span className="text-foreground font-medium tabular-nums">
              {value} {unit}
            </span>
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-destructive text-sm">
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
 * "stop tracking waist" vs "that entry was a typo".
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" className="text-destructive hover:text-destructive h-11 w-full gap-2" />
        }
      >
        <Trash2 aria-hidden className="size-4" />
        Stop tracking this
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop tracking this measurement?</DialogTitle>
          <DialogDescription>
            It disappears from your list. Its readings are kept in the database,
            so nothing is lost if you want it back later.
          </DialogDescription>
        </DialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-destructive text-sm">
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
  );
}
