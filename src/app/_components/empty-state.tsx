import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action: { href: string; label: string };
};

/**
 * The dashboard's shared first-run / nothing-logged-yet block.
 *
 * Deliberately a dashed outline rather than a `Card`: an empty card reads like
 * a card with missing data, while the dashed edge reads as a prompt. The CTA is
 * `h-11` so it stays a comfortable tap target on the gym floor.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-5 py-8 text-center">
      <Icon aria-hidden className="text-muted-foreground size-6" />

      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        <p className="text-muted-foreground max-w-[32ch] text-sm text-balance">
          {description}
        </p>
      </div>

      <Link
        href={action.href}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-11 px-4",
        )}
      >
        {action.label}
      </Link>
    </div>
  );
}
