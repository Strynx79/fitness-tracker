"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

import { startRoutine } from "@/app/routines/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StartRoutineButtonProps = {
  routineId: string;
  /** "lg" on the routine page, compact in the Today card. */
  size?: "default" | "lg";
  className?: string;
};

/**
 * Start a routine now.
 *
 * The action creates the session and copies the routine's exercises in, then we
 * navigate to it — logging is the only useful next step.
 */
export function StartRoutineButton({
  routineId,
  size = "default",
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
      size={size}
      disabled={pending}
      onClick={handleStart}
      className={cn(size === "lg" && "h-12 w-full text-base", className)}
    >
      <Play aria-hidden className="size-4" />
      {pending ? "Starting…" : "Start"}
    </Button>
  );
}
