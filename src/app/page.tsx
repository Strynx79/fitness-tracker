import { Activity, CheckCircle2, Circle, Database, Dumbbell, Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const slices = [
  { name: "Slice 1 — Daily Metrics & Macros", icon: Activity, ready: false },
  { name: "Slice 2 — Habit Engine", icon: Flame, ready: false },
  { name: "Slice 3 — Workout Logger", icon: Dumbbell, ready: false },
  { name: "Slice 4 — Unified Dashboard", icon: CheckCircle2, ready: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Fitness &amp; Self-Improvement OS
        </h1>
        <p className="text-muted-foreground text-sm">
          Slice 0 complete — the scaffold, database, and schema are in place.
        </p>
        <Badge variant="secondary" className="w-fit">
          <Database />
          Bootstrapped
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Build order</CardTitle>
          <CardDescription>
            Features land one vertical slice at a time: Database → Server Action →
            UI → QA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {slices.map(({ name, icon: Icon, ready }) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                {ready ? (
                  <CheckCircle2 className="text-primary size-4 shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground size-4 shrink-0" />
                )}
                <Icon className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground">{name}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
