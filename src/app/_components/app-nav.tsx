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
 * The app's only navigation, in two shapes.
 *
 * On a phone it is the fixed bottom bar: five 56px targets reachable with a
 * thumb, padded for the iOS home indicator. From `lg` up it becomes the 48px
 * bar the direction deals for this product — wordmark on the page column's left
 * edge, plain text links, settings at the far right — because a floating tab bar
 * stretched across a 1440px screen is phone chrome pasted onto a desk.
 *
 * Both render at all times and CSS decides which is visible, so nothing flickers
 * on resize and there is no client-side media query. No blur, no translucency:
 * the bar is the page ground with one rule.
 *
 * `usePathname()` is URL data: on a dynamic route such as `/workouts/[id]` it is
 * only known at request time, so reading it outside a Suspense boundary blocks
 * prerendering under Cache Components. Each tab therefore renders its static
 * link immediately and streams in only its own active flag. The bar itself still
 * ships in the static shell, and `/` gets its active state prerendered.
 */
export function AppTopBar() {
  return (
    <header className="bg-background sticky top-0 z-40 hidden border-b border-rule lg:block">
      <div className="mx-auto flex h-12 w-full max-w-[1200px] items-center gap-7 px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring/50 rounded-sm text-[15px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          Fitness OS
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-6">
          {TABS.map((tab) => (
            <Suspense key={tab.href} fallback={<TopLink tab={tab} active={false} />}>
              <ActiveTopLink tab={tab} />
            </Suspense>
          ))}
        </nav>

        <div className="ml-auto">
          <Suspense fallback={<SettingsLink active={false} />}>
            <ActiveSettingsLink />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export function AppTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="bg-background fixed inset-x-0 bottom-0 z-50 border-t border-rule pb-[env(safe-area-inset-bottom)] lg:hidden"
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

function ActiveTopLink({ tab }: { tab: Tab }) {
  const pathname = usePathname();
  return <TopLink tab={tab} active={isActive(pathname, tab.href)} />;
}

function TopLink({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {tab.label}
    </Link>
  );
}

function ActiveSettingsLink() {
  const pathname = usePathname();
  return <SettingsLink active={isActive(pathname, "/settings")} />;
}

function SettingsLink({ active }: { active: boolean }) {
  return (
    <Link
      href="/settings"
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 rounded-sm text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      Settings
    </Link>
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
        "focus-visible:ring-ring/50 relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.7rem] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
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
