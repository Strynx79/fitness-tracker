"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { startRoutine } from "@/app/routines/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StartRoutineButtonProps = {
  routineId: string;
  className?: string;
};

/**
 * Start a routine now.
 *
 * The action creates the session and copies the routine's exercises in, then we
 * navigate to it — logging is the only useful next step. This is the routine
 * detail screen's single filled primary.
 */
export function StartRoutineButton({
  routineId,
  className,
}: StartRoutineButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      const result = await startRoutine(routineId);

      if (!result.ok) {
        // Nothing on screen to anchor to; the button re-enables and the user can
        // retry. A toast would be behind the dialog layer, so keep it simple.
        return;
      }

      if (result.sessionId !== undefined) {
        router.push(`/workouts/${result.sessionId}`);
      }
    });
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={handleStart}
      className={cn("h-10 rounded-md px-4 text-sm", className)}
    >
      <Play aria-hidden className="size-4" />
      {pending ? "Starting…" : "Start workout"}
    </Button>
  );
}
