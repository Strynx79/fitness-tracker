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
import { parseIsoDate } from "@/lib/date";
import type { MeasurementPoint } from "@/lib/measurements";

type MeasurementChartProps = {
  points: MeasurementPoint[];
  unit: string;
};

const chartConfig = {
  value: {
    label: "Reading",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/** Short axis labels ("Oct 18"), formatted in UTC because dates have no time. */
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatShortDate(iso: string): string {
  return shortDateFormatter.format(parseIsoDate(iso));
}

/**
 * Trend line for one measurement.
 *
 * Points are actual readings, not a filled daily series: unlike weight, nobody
 * measures their waist every day, so a line between readings is honest and a
 * zero-filled day would not be.
 */
export function MeasurementChart({ points, unit }: MeasurementChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend</CardTitle>
        <CardDescription>
          {points.length < 2
            ? "Log a second reading and the trend starts here."
            : `${points.length} readings, oldest to newest.`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {points.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No readings yet</p>
            <p className="text-muted-foreground max-w-[24ch] text-xs">
              Log one above and it appears here.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                domain={["dataMin - 1", "dataMax + 1"]}
                tickLine={false}
                axisLine={false}
                width={52}
                tickMargin={4}
                tickFormatter={(value: number) => `${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) =>
                      typeof label === "string" ? formatShortDate(label) : null
                    }
                    formatter={(value) => `${value} ${unit}`}
                  />
                }
              />
              <Line
                dataKey="value"
                type="linear"
                stroke="var(--color-value)"
                strokeWidth={2}
                // A single reading still has to be visible; with two or more the
                // dots become noise.
                dot={points.length <= 14 ? { r: 3 } : false}
                connectNulls={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
