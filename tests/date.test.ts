import assert from "node:assert/strict";
import { test } from "node:test";

import { addDays, isIsoDate, isoDateInZone, isoDateRange } from "@/lib/date";

test("isIsoDate accepts real calendar dates", () => {
  assert.equal(isIsoDate("2026-10-20"), true);
  assert.equal(isIsoDate("2024-02-29"), true, "leap day");
  assert.equal(isIsoDate("2026-01-01"), true);
});

test("isIsoDate rejects impossible or malformed dates", () => {
  for (const value of [
    "2026-02-30",
    "2026-13-01",
    "2026-2-3",
    "",
    "abc",
    "2026-00-10",
    "2026-10-32",
    "2026-10-20T00:00:00Z",
  ]) {
    assert.equal(isIsoDate(value), false, `expected ${JSON.stringify(value)} to be invalid`);
  }
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29", "leap year");
  assert.equal(addDays("2026-10-20", 0), "2026-10-20");
});

test("addDays is unaffected by the US spring-forward DST boundary", () => {
  // US clocks jump forward on 2026-03-08. UTC-midnight arithmetic must still
  // produce exactly one calendar day per step, not a 23-hour day.
  assert.equal(addDays("2026-03-07", 1), "2026-03-08");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDays("2026-03-06", 3), "2026-03-09");
  assert.equal(addDays("2026-03-09", -3), "2026-03-06");
});

test("addDays rejects fractional days", () => {
  assert.throws(() => addDays("2026-10-20", 1.5), /whole days/);
});

test("isoDateRange validates both endpoints before iterating", () => {
  assert.throws(() => isoDateRange("2026-02-30", "2026-03-01"), /Invalid date range/);
  assert.throws(() => isoDateRange("2026-03-01", "abc"), /Invalid date range/);
});

test("isoDateRange is inclusive and handles single-day ranges", () => {
  assert.deepEqual(isoDateRange("2026-02-27", "2026-03-01"), [
    "2026-02-27",
    "2026-02-28",
    "2026-03-01",
  ]);
  assert.deepEqual(isoDateRange("2026-10-20", "2026-10-20"), ["2026-10-20"]);
});

test("isoDateRange enforces the 3660-day cap", () => {
  const start = "2020-01-01";
  const exactlyAtCap = isoDateRange(start, addDays(start, 3659));
  assert.equal(exactlyAtCap.length, 3660);

  assert.throws(
    () => isoDateRange(start, addDays(start, 3660)),
    /exceeds 3660 days/,
  );
});

test("isoDateInZone uses the zone's calendar day, not the UTC day", () => {
  // 01:00 IST on Oct 19 is still Oct 18 in UTC — the exact off-by-one the
  // helper exists to prevent.
  const instant = new Date("2026-10-18T19:30:00Z");

  assert.equal(instant.toISOString().slice(0, 10), "2026-10-18");
  assert.equal(isoDateInZone(instant, "Asia/Kolkata"), "2026-10-19");
  assert.equal(isoDateInZone(instant, "UTC"), "2026-10-18");
});
