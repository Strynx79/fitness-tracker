"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { WeightPoint } from "@/lib/daily-metrics";
import { parseIsoDate } from "@/lib/date";
import { cn } from "@/lib/utils";

const chartConfig = {
  weightKg: {
    label: "Weight",
    // The one hue in the system; already the royal blue.
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * "Oct 18" from a `YYYY-MM-DD` string.
 *
 * Explicit UTC: the value is a date-only string pinned at UTC midnight, and
 * formatting it in the runtime's zone would print the previous day anywhere
 * west of UTC.
 */
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatShortDate(iso: string): string {
  return SHORT_DATE.format(parseIsoDate(iso));
}

type WeightTrendChartProps = {
  /** Contiguous, ascending, one point per day; `weightKg` is null for gaps. */
  data: WeightPoint[];
  /** Length of the window, used for the heading copy. */
  days: number;
  className?: string;
};

/**
 * The 30-day weight line.
 *
 * One series, no legend and no markers: the gaps are the information. The area
 * fill is the token's own 12%, so it never becomes a second colour. With no
 * weigh-in the panel keeps its frame and draws an honest empty axis — a
 * baseline and real date labels — rather than a line through invented points.
 */
export function WeightTrendChart({ data, days, className }: WeightTrendChartProps) {
  const hasAnyWeight = data.some((point) => point.weightKg !== null);
  const firstDate = data[0]?.date;
  const middleDate = data[Math.floor(data.length / 2)]?.date;
  const lastDate = data[data.length - 1]?.date;

  return (
    <section
      aria-labelledby="weight-trend-heading"
      className={cn("bg-card flex flex-col rounded-lg p-5 sm:p-6", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="weight-trend-heading" className="text-base font-medium">
          Weight trend
        </h2>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          Last {days} days
        </p>
      </div>

      <p className="text-muted-foreground mt-1 text-[13px]">
        Kilograms; a gap is a day without a weigh-in.
      </p>

      <div className="mt-5">
        {hasAnyWeight ? (
          <ChartContainer
            config={chartConfig}
            className="h-[260px] w-full sm:h-[300px]"
          >
            <AreaChart
              data={data}
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
                // Pads the range so a 0.4 kg week still reads as a slope.
                domain={["dataMin - 1", "dataMax + 1"]}
                tickLine={false}
                axisLine={false}
                width={40}
                tickMargin={4}
                tickCount={4}
                tickFormatter={(value: number) => value.toFixed(1)}
              />

              <Area
                dataKey="weightKg"
                type="linear"
                stroke="var(--color-weightKg)"
                strokeWidth={2}
                fill="var(--data-soft)"
                dot={false}
                activeDot={false}
                // A gap must stay a gap: joining across nulls would draw a
                // weigh-in that never happened.
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
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
                <p className="text-muted-foreground text-sm">
                  No weigh-ins in the last {days} days.
                </p>
                <Link
                  href="#entry"
                  className="focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-md text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Log a weigh-in
                </Link>
              </div>
            </div>

            <div className="border-rule text-muted-foreground flex justify-between border-t pt-2 font-mono text-xs tabular-nums">
              {firstDate === undefined ? null : (
                <span>{formatShortDate(firstDate)}</span>
              )}
              {middleDate === undefined ? null : (
                <span>{formatShortDate(middleDate)}</span>
              )}
              {lastDate === undefined ? null : (
                <span>{formatShortDate(lastDate)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
