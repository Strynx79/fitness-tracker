import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/app/_components/back-link";
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
      <BackLink href="/" label="Home" />

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
