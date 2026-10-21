"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Server Component errors are forwarded to the client with a generic message
 * (the real one stays in the server logs), so the digest is the only detail
 * worth showing. It is a log identifier, not an error message, and is rendered
 * as a small selectable reference rather than user-facing prose.
 */
function getErrorDigest(error: unknown): string | null {
  if (!(error instanceof Error) || !("digest" in error)) return null;

  const { digest } = error;
  return typeof digest === "string" && digest.length > 0 ? digest : null;
}

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest = getErrorDigest(error);

  useEffect(() => {
    // Keep the full value in the browser console for local debugging. It is
    // never rendered: `error.message` can leak server-side details.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-6">
      <Card>
        <CardHeader className="items-start gap-2">
          <span
            aria-hidden
            className="bg-muted text-muted-foreground mb-1 flex size-10 items-center justify-center rounded-full"
          >
            <TriangleAlert className="size-5" />
          </span>

          <h1 className="font-heading text-xl leading-snug font-semibold tracking-tight">
            Something went wrong
          </h1>
          <CardDescription className="max-w-[40ch] text-balance">
            This screen hit an unexpected snag. Try again — if it keeps
            happening, head back home and reopen it.
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex-col items-stretch gap-2">
          <Button className="h-11 w-full" onClick={() => retry()}>
            <RefreshCw aria-hidden />
            Try again
          </Button>

          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 w-full",
            )}
          >
            Back to home
          </Link>

          {digest ? (
            <p className="text-muted-foreground mt-1 w-full text-center font-mono text-[0.7rem] break-all select-all">
              Reference: {digest}
            </p>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}
