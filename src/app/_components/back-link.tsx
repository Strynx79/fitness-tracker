import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type BackLinkProps = {
  /** Where "back" goes when there is no history to pop — always the parent. */
  href: string;
  label: string;
  className?: string;
};

/**
 * The one back control used by every sub-page.
 *
 * A plain link rather than `router.back()`: a deep link opened from a
 * notification, a refresh, or a new tab has no history to pop, and a back button
 * that sometimes does nothing is worse than one that always goes to the parent
 * list. It is also 44px tall and works without JavaScript.
 */
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none",
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </Link>
  );
}
