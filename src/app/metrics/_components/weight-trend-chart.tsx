"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { WeightPoint } from "@/lib/daily-metrics";
import { parseIsoDate } from "@/lib/date";

const chartConfig = {
  weightKg: {
    label: "Weight",
    // Greyscale by design — this theme's chart tokens are neutral.
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/**
 * Short axis labels ("Oct 18") from a `YYYY-MM-DD` string.
 *
 * Explicit UTC formatting: `new Date("2026-10-18")` is parsed as UTC midnight
 * and `toLocaleDateString()` then renders the day *before* it in any negative
 * offset, so the two never get combined.
 */
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatShortDate(iso: string): string {
  return shortDateFormatter.format(parseIsoDate(iso));
}

type WeightTrendChartProps = {
  /** Contiguous, ascending, one point per day; `weightKg` is null for gaps. */
  data: WeightPoint[];
  /** Length of the window, used for the heading copy. */
  days: number;
};

export function WeightTrendChart({ data, days }: WeightTrendChartProps) {
  const hasAnyWeight = data.some((point) => point.weightKg !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weight trend</CardTitle>
        <CardDescription>
          Last {days} days. A break in the line is a day without a weigh-in — never
          an interpolated guess.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasAnyWeight ? (
          // Explicit height: ChartContainer defaults to aspect-video, which is
          // too short for a 30-day series on a phone.
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={(value: string) => formatShortDate(value)}
              />
              <YAxis
                // Pads the range so a 0.4 kg week is still visually distinct.
                domain={["dataMin - 1", "dataMax + 1"]}
                tickLine={false}
                axisLine={false}
                width={56}
                tickMargin={4}
                tickFormatter={(value: number) => `${value} kg`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) =>
                      typeof label === "string" ? formatShortDate(label) : null
                    }
                  />
                }
              />
              <Line
                dataKey="weightKg"
                type="linear"
                stroke="var(--color-weightKg)"
                strokeWidth={2}
                dot={false}
                // A gap must stay a gap: connecting across nulls would draw a
                // weigh-in that never happened.
                connectNulls={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No weigh-ins yet</p>
            <p className="text-muted-foreground max-w-[24ch] text-xs">
              Log a weight above and your trend line starts here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
