import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeightSeries } from "@/lib/weight-series";

test("buildWeightSeries returns every day in the range, including gaps", () => {
  const history = [
    { date: "2026-10-17", weightKg: 80.4 },
    { date: "2026-10-15", weightKg: 81 },
    // A logged day without a weigh-in must not become a data point.
    { date: "2026-10-18", weightKg: null },
  ];

  assert.deepEqual(buildWeightSeries(history, "2026-10-14", "2026-10-20"), [
    { date: "2026-10-14", weightKg: null },
    { date: "2026-10-15", weightKg: 81 },
    { date: "2026-10-16", weightKg: null },
    { date: "2026-10-17", weightKg: 80.4 },
    { date: "2026-10-18", weightKg: null },
    { date: "2026-10-19", weightKg: null },
    { date: "2026-10-20", weightKg: null },
  ]);
});

test("buildWeightSeries is ascending for an empty history", () => {
  const series = buildWeightSeries([], "2026-10-18", "2026-10-20");

  assert.deepEqual(series, [
    { date: "2026-10-18", weightKg: null },
    { date: "2026-10-19", weightKg: null },
    { date: "2026-10-20", weightKg: null },
  ]);
});

test("buildWeightSeries handles a single-day range", () => {
  assert.deepEqual(
    buildWeightSeries([{ date: "2026-10-20", weightKg: 79.8 }], "2026-10-20", "2026-10-20"),
    [{ date: "2026-10-20", weightKg: 79.8 }],
  );
});
