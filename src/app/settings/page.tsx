import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { PageShell, ScreenHeader } from "@/app/_components/page-shell";
import { BackLink } from "@/app/_components/back-link";
import {
  GoalWeightForm,
  TimezoneForm,
} from "@/app/settings/_components/settings-forms";
import { SettingsSkeleton } from "@/app/settings/_components/settings-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listTimezones } from "@/lib/timezones";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Settings.
 *
 * The page body is synchronous: the only request-bound work is the user and the
 * catalog count, which live behind one Suspense boundary. Awaiting them here
 * would make the route uncached above the boundary and fail `next build` under
 * Cache Components.
 */
export default function SettingsPage() {
  return (
    <PageShell>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </PageShell>
  );
}

type SettingsSectionProps = {
  /** The section's one heading, 16/500. A noun, not a sentence. */
  title: string;
  /** One sentence explaining what this section assumes about the reader. */
  description: string;
  /** The white panel beside the label column. */
  children: ReactNode;
};

/**
 * One settings section.
 *
 * A label column (title plus its explanation) beside the panel, never a card
 * grid: at `lg` the label takes two fifths and the panel three fifths, and on a
 * phone the two stack. The section owns no rule of its own — the page puts an
 * `hr` between them so the line runs the full width.
 */
function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  const headingId = `settings-${title.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={headingId} className="text-base leading-snug font-medium">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm leading-snug">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

async function SettingsContent() {
  const user = await getCurrentUser();
  // A real count, not a copy of the dataset size: if the seed changes, the
  // sentence under Data changes with it.
  const exerciseCount = await prisma.exercise.count();

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink
          href="/"
          label="Home"
          className="-ml-2 h-10 px-2 text-[13px]"
        />
        <ScreenHeader
          title="Settings"
          description={`Times are shown in ${user.timezone}.`}
        />
      </div>

      <div className="flex flex-col">
        <SettingsSection
          title="Profile"
          description="The weight the dashboard measures your progress toward."
        >
          <div className="bg-card rounded-lg p-5 sm:p-6">
            <GoalWeightForm
              timezone={user.timezone}
              // `Prisma.Decimal` is not serializable to a Client Component;
              // convert on the server or the render throws at runtime.
              goalWeightKg={user.goalWeightKg?.toNumber() ?? null}
            />
          </div>
        </SettingsSection>

        <hr className="border-rule my-8 border-t" />

        <SettingsSection
          title="Time zone"
          description="Changing this moves what counts as “today” for habits, metrics and the dashboard — a day logged late may shift by one calendar day."
        >
          <div className="bg-card rounded-lg p-5 sm:p-6">
            <TimezoneForm
              timezone={user.timezone}
              goalWeightKg={user.goalWeightKg?.toNumber() ?? null}
              timezones={listTimezones(user.timezone)}
            />
          </div>
        </SettingsSection>

        <hr className="border-rule my-8 border-t" />

        <SettingsSection
          title="Data"
          description="The catalog is shared and read-only. Nothing you log changes it."
        >
          <div className="bg-card rounded-lg px-5 py-1 sm:px-6">
            <dl className="divide-rule divide-y">
              <div className="flex h-12 items-center justify-between gap-4">
                <dt className="text-sm">Exercise catalog</dt>
                <dd className="text-muted-foreground text-right text-[13px]">
                  <span className="text-foreground font-mono tabular-nums">
                    {exerciseCount.toLocaleString("en-US")}
                  </span>{" "}
                  exercises
                </dd>
              </div>
            </dl>
          </div>
        </SettingsSection>
      </div>
    </>
  );
}
