import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeWeight } from "@/lib/weight-summary";

type WeighIn = { date: string; weightKg: number };

const latest: WeighIn = { date: "2026-10-20", weightKg: 79.8 };
const baseline: WeighIn = { date: "2026-10-13", weightKg: 80.4 };

test("missing latest weigh-in yields null for both fields", () => {
  const summary = summarizeWeight({ latest: null, goalKg: 75, baseline });

  assert.deepEqual(summary, { deltaKg: null, change7dKg: null });
});

test("a missing goal nulls only deltaKg", () => {
  const summary = summarizeWeight({ latest, goalKg: null, baseline });

  assert.equal(summary.deltaKg, null);
  assert.equal(summary.change7dKg, -0.6);
});

test("a missing baseline nulls only change7dKg", () => {
  const summary = summarizeWeight({ latest, goalKg: 75, baseline: null });

  assert.equal(summary.deltaKg, 4.8);
  assert.equal(summary.change7dKg, null);
});

test("deltaKg is positive when above goal and negative when below", () => {
  const above = summarizeWeight({
    latest: { date: "2026-10-20", weightKg: 79.8 },
    goalKg: 75,
    baseline: null,
  });
  const below = summarizeWeight({
    latest: { date: "2026-10-20", weightKg: 73.5 },
    goalKg: 75,
    baseline: null,
  });

  assert.equal(above.deltaKg, 4.8);
  assert.equal(below.deltaKg, -1.5);
});

test("79.8 - 75 rounds to exactly 4.8, not float noise", () => {
  const summary = summarizeWeight({ latest, goalKg: 75, baseline });

  assert.equal(summary.deltaKg, 4.8);
  assert.ok(Object.is(summary.deltaKg, 4.8));
});

test("change7dKg is the rounded latest-minus-baseline difference", () => {
  const summary = summarizeWeight({ latest, goalKg: 75, baseline });

  assert.equal(summary.change7dKg, -0.6);
  assert.ok(Object.is(summary.change7dKg, -0.6));
});

test("every missing-input combination yields an exact null or finite number, never NaN", () => {
  // The full cross-product, with the expected result spelled out per case.
  // `Number.isNaN(null) === false` used to make the old test pass for both
  // `null` and `undefined`, so it could not catch a wrong null/number choice.
  const cases: Array<{
    label: string;
    latest: WeighIn | null;
    goalKg: number | null;
    baseline: WeighIn | null;
    expected: { deltaKg: number | null; change7dKg: number | null };
  }> = [
    {
      label: "latest missing, no goal, no baseline",
      latest: null,
      goalKg: null,
      baseline: null,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest missing, no goal, baseline present",
      latest: null,
      goalKg: null,
      baseline,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest missing, goal 0, no baseline",
      latest: null,
      goalKg: 0,
      baseline: null,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest missing, goal 0, baseline present",
      latest: null,
      goalKg: 0,
      baseline,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest missing, goal 75, no baseline",
      latest: null,
      goalKg: 75,
      baseline: null,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest missing, goal 75, baseline present",
      latest: null,
      goalKg: 75,
      baseline,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest present, no goal, no baseline",
      latest,
      goalKg: null,
      baseline: null,
      expected: { deltaKg: null, change7dKg: null },
    },
    {
      label: "latest present, no goal, baseline present",
      latest,
      goalKg: null,
      baseline,
      expected: { deltaKg: null, change7dKg: -0.6 },
    },
    {
      label: "latest present, goal 0, no baseline",
      latest,
      goalKg: 0,
      baseline: null,
      expected: { deltaKg: 79.8, change7dKg: null },
    },
    {
      label: "latest present, goal 0, baseline present",
      latest,
      goalKg: 0,
      baseline,
      expected: { deltaKg: 79.8, change7dKg: -0.6 },
    },
    {
      label: "latest present, goal 75, no baseline",
      latest,
      goalKg: 75,
      baseline: null,
      expected: { deltaKg: 4.8, change7dKg: null },
    },
    {
      label: "latest present, goal 75, baseline present",
      latest,
      goalKg: 75,
      baseline,
      expected: { deltaKg: 4.8, change7dKg: -0.6 },
    },
  ];

  for (const entry of cases) {
    const summary = summarizeWeight({
      latest: entry.latest,
      goalKg: entry.goalKg,
      baseline: entry.baseline,
    });

    assert.deepEqual(summary, entry.expected, entry.label);
    for (const value of [summary.deltaKg, summary.change7dKg]) {
      if (value !== null) assert.ok(Number.isFinite(value), entry.label);
    }
  }
});
