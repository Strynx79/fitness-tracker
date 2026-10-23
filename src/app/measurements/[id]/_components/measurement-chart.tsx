"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { parseIsoDate } from "@/lib/date";
import type { MeasurementPoint } from "@/lib/measurements";
import { cn } from "@/lib/utils";

const chartConfig = {
  value: {
    label: "Reading",
    // The one hue in the system; already the royal blue.
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * "Oct 18" from a `YYYY-MM-DD` string.
 *
 * Explicit UTC: the value is a date-only string pinned at UTC midnight, and
 * formatting it in the runtime's zone would print the previous day west of UTC.
 */
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatShortDate(iso: string): string {
  return SHORT_DATE.format(parseIsoDate(iso));
}

type MeasurementChartProps = {
  /** Actual readings, ascending by date. Nothing is interpolated. */
  points: MeasurementPoint[];
  className?: string;
};

/**
 * The trend line for one measurement.
 *
 * One series, no legend and no markers: the line joins real readings only.
 * Unlike weight, nobody measures their waist every day, so a zero-filled day
 * would draw a reading that never happened. With no readings the panel keeps
 * its frame and draws an honest empty axis rather than a line through points
 * that do not exist.
 */
export function MeasurementChart({ points, className }: MeasurementChartProps) {
  const count = points.length;

  const subline =
    count === 0
      ? "A line between real readings only."
      : count === 1
        ? "One reading; the line starts with the second."
        : "Real readings only; the gaps are days without a measurement.";

  return (
    <section
      aria-labelledby="measurement-trend-heading"
      className={cn("bg-card flex flex-col rounded-lg p-5 sm:p-6", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="measurement-trend-heading" className="text-base font-medium">
          Trend
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {count === 0 ? "No readings" : `${count} reading${count === 1 ? "" : "s"}`}
        </p>
      </div>

      <p className="text-muted-foreground mt-1 text-[13px]">{subline}</p>

      <div className="mt-5">
        {count === 0 ? (
          <div className="flex h-[260px] w-full flex-col sm:h-[300px]">
            <div className="relative flex-1">
              <div aria-hidden className="absolute inset-0">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    style={{ top: `${index * 25}%` }}
                    className="bg-border absolute inset-x-0 block h-px"
                  />
                ))}
              </div>

              <div className="relative flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
                <p className="text-muted-foreground text-sm">No readings yet.</p>
                <Link
                  href="#entry"
                  className="focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Log a reading
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="h-[260px] w-full sm:h-[300px]"
          >
            <AreaChart
              data={points}
              margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickMargin={8}
                minTickGap={36}
                tickFormatter={(value: string) => formatShortDate(value)}
              />

              <YAxis
                // Pads the range so a 0.5 cm week still reads as a slope.
                domain={["dataMin - 1", "dataMax + 1"]}
                tickLine={false}
                axisLine={false}
                width={40}
                tickMargin={4}
                tickCount={4}
                tickFormatter={(value: number) => value.toFixed(1)}
              />

              <Area
                dataKey="value"
                type="linear"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill="var(--data-soft)"
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
