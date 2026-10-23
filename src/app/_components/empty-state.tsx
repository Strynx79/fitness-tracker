import Link from "next/link";

type EmptyStateProps = {
  /** One 14px sentence, in the words of the trade. Never an instruction. */
  description: string;
  /** The one route that fills this block. */
  action: { href: string; label: string };
};

/**
 * The body of a block that has nothing in it yet.
 *
 * The frame and the heading belong to `DashboardPanel`; this only supplies the
 * sentence and the link. That split is deliberate: an empty block is still the
 * same block, so it keeps its heading and its surface instead of collapsing
 * into a dashed prompt. No illustration, no icon, no sample numbers.
 */
export function EmptyState({ description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className="text-muted-foreground text-sm">{description}</p>

      <Link
        href={action.href}
        className="focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {action.label}
      </Link>
    </div>
  );
}
