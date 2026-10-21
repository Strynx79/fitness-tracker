import Link from "next/link";
import { Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-10 text-center">
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full"
        >
          <Compass className="size-5" />
        </span>

        <p className="text-muted-foreground font-mono text-xs tracking-[0.2em]">
          404
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground max-w-[32ch] text-sm text-balance">
          That screen does not exist — it may have moved, or the link may be
          out of date.
        </p>

        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-1 h-11 px-4",
          )}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
