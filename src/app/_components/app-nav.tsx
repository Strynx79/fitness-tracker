"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Dumbbell, Flame, House, Library } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/metrics", label: "Metrics", icon: Activity },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
] as const;

type Tab = (typeof TABS)[number];

/**
 * Prefix matching keeps `/workouts/[id]` on the Workouts tab, but `/` must be
 * exact — otherwise every route starts with "/" and Home is always active.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The app's only navigation. Fixed to the bottom so it is reachable with a
 * thumb, `min-h-14` per tab for a 56px tap target, and padded for the iOS home
 * indicator. The layout reserves the same height under the page content.
 *
 * `usePathname()` is URL data: on a dynamic route such as `/workouts/[id]` it is
 * only known at request time, so reading it outside a Suspense boundary blocks
 * prerendering under Cache Components. Each tab therefore renders its static
 * link immediately and streams in only its own active flag. The whole bar still
 * ships in the static shell, and `/` gets its active state prerendered.
 */
export function AppNav() {
  return (
    <nav
      aria-label="Primary"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      {/* Five tabs at 56px each still fit a 360px viewport (72px per tab). */}
      <ul className="mx-auto grid w-full max-w-2xl grid-cols-5">
        {TABS.map((tab) => (
          <li key={tab.href}>
            <Suspense fallback={<TabLink tab={tab} active={false} />}>
              <ActiveTabLink tab={tab} />
            </Suspense>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ActiveTabLink({ tab }: { tab: Tab }) {
  const pathname = usePathname();
  return <TabLink tab={tab} active={isActive(pathname, tab.href)} />;
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const { href, label, icon: Icon } = tab;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.7rem] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="bg-foreground absolute inset-x-5 top-0 h-0.5 rounded-full"
        />
      ) : null}
      <Icon aria-hidden className={cn("size-5", active && "stroke-[2.25]")} />
      <span>{label}</span>
    </Link>
  );
}
