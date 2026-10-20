import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { ProfileForm } from "@/app/settings/_components/profile-form";
import { SettingsSkeleton } from "@/app/settings/_components/settings-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listTimezones } from "@/lib/timezones";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Settings.
 *
 * The page body is synchronous: the only request-bound work is
 * `getCurrentUser()`, which lives behind its own Suspense boundary. Awaiting it
 * here would make the route uncached above the boundary and fail `next build`
 * under Cache Components.
 */
export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Today
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Your timezone and goal weight. Everything else stays on the dashboard.
        </p>
      </header>

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}

async function SettingsContent() {
  const user = await getCurrentUser();

  return (
    <ProfileForm
      timezone={user.timezone}
      // `Prisma.Decimal` is not serializable to a Client Component; convert on
      // the server or the render throws at runtime.
      goalWeightKg={user.goalWeightKg?.toNumber() ?? null}
      timezones={listTimezones(user.timezone)}
    />
  );
}
