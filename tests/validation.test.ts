import assert from "node:assert/strict";
import { test } from "node:test";

import { dailyMetricInputSchema } from "@/lib/validations/daily-metric";
import { createHabitSchema } from "@/lib/validations/habit";
import { isValidTimeZone, profileSchema } from "@/lib/validations/profile";
import { logSetSchema } from "@/lib/validations/workout";

/**
 * These tests import the schemas the app actually ships. Cloning the builders
 * here (the previous approach) meant a copy change or a range drift in
 * production could not fail this file — it even asserted a `"Enter weight."`
 * message the app never emits.
 */

/** The minimum valid log-set payload; each test overrides one field. */
const validLogSet = {
  sessionId: "session-1",
  exerciseName: "Bench Press",
  weightKg: "80",
  reps: "5",
};

const TODAY = "2026-10-20";

type SafeParseResult =
  | { success: true; data: unknown }
  | {
      success: false;
      error: { issues: Array<{ path: PropertyKey[]; message: string }> };
    };

/** The first message for `field`; fails when the payload unexpectedly parses. */
function issueMessage(result: SafeParseResult, field: string): string {
  if (result.success) assert.fail(`expected "${field}" to be rejected`);
  const issue = result.error.issues.find((candidate) => candidate.path[0] === field);
  if (issue === undefined) assert.fail(`expected an issue on "${field}"`);
  return issue.message;
}

test("blank, whitespace and absent optional decimals become null", () => {
  for (const value of ["", "   ", null, undefined]) {
    assert.equal(
      profileSchema.parse({ timezone: "Asia/Kolkata", goalWeightKg: value }).goalWeightKg,
      null,
    );
    assert.equal(logSetSchema.parse({ ...validLogSet, rpe: value }).rpe, null);
  }

  // A key that is absent from the payload behaves like an empty input.
  assert.equal(profileSchema.parse({ timezone: "Asia/Kolkata" }).goalWeightKg, null);
  assert.equal(logSetSchema.parse(validLogSet).rpe, null);
});

test("createHabitSchema normalizes a blank description to null", () => {
  for (const value of ["", "   ", null]) {
    assert.equal(
      createHabitSchema.parse({ name: "Read", description: value }).description,
      null,
    );
  }

  assert.equal(
    createHabitSchema.parse({ name: "Read", description: " 20 pages " }).description,
    "20 pages",
  );
});

test('a real "0" survives as 0 for calories-style integers, but not for a weigh-in', () => {
  assert.equal(
    dailyMetricInputSchema.parse({ date: TODAY, calories: "0" }).calories,
    0,
  );
  assert.equal(dailyMetricInputSchema.parse({ date: TODAY, proteinG: "0" }).proteinG, 0);

  // A weigh-in of 0 is a missing measurement, not a real value.
  assert.equal(
    issueMessage(
      dailyMetricInputSchema.safeParse({ date: TODAY, weightKg: "0" }),
      "weightKg",
    ),
    "Weight must be greater than 0.",
  );
});

test("workout weight accepts 0 (bodyweight) and rejects negatives", () => {
  assert.equal(logSetSchema.parse({ ...validLogSet, weightKg: "0" }).weightKg, 0);
  assert.equal(
    issueMessage(
      logSetSchema.safeParse({ ...validLogSet, weightKg: "-1" }),
      "weightKg",
    ),
    "Weight can't be negative.",
  );
});

test("a required weight rejects blank and absent input with the production message", () => {
  for (const payload of [
    { ...validLogSet, weightKg: "" },
    { ...validLogSet, weightKg: "   " },
    { sessionId: "session-1", exerciseName: "Bench Press", reps: "5" },
  ]) {
    assert.equal(
      issueMessage(logSetSchema.safeParse(payload), "weightKg"),
      "Enter the weight. Use 0 for bodyweight.",
    );
  }
});

test("a third decimal is rejected on both shipped weight schemas", () => {
  assert.equal(
    issueMessage(
      logSetSchema.safeParse({ ...validLogSet, weightKg: "80.555" }),
      "weightKg",
    ),
    "Weight can have at most 2 decimal places.",
  );
  assert.equal(
    issueMessage(
      profileSchema.safeParse({ timezone: "Asia/Kolkata", goalWeightKg: "80.555" }),
      "goalWeightKg",
    ),
    "Weight can have at most 2 decimal places.",
  );
});

test("workout weight is capped at 400 kg", () => {
  assert.equal(logSetSchema.parse({ ...validLogSet, weightKg: "400" }).weightKg, 400);
  assert.equal(
    issueMessage(
      logSetSchema.safeParse({ ...validLogSet, weightKg: "400.01" }),
      "weightKg",
    ),
    "Weight must be 400 kg or less.",
  );
});

test("reps is a whole number of at least 1", () => {
  assert.equal(logSetSchema.parse({ ...validLogSet, reps: "1" }).reps, 1);
  assert.equal(logSetSchema.parse({ ...validLogSet, reps: "1000" }).reps, 1_000);

  assert.equal(
    issueMessage(logSetSchema.safeParse({ ...validLogSet, reps: "0" }), "reps"),
    "Reps must be at least 1.",
  );
  assert.equal(
    issueMessage(logSetSchema.safeParse({ ...validLogSet, reps: "1001" }), "reps"),
    "Reps must be 1000 or less.",
  );
  assert.equal(
    issueMessage(logSetSchema.safeParse({ ...validLogSet, reps: "1.5" }), "reps"),
    "Reps must be a whole number.",
  );
  assert.equal(
    issueMessage(logSetSchema.safeParse({ ...validLogSet, reps: "1e3" }), "reps"),
    "Reps must be a number.",
  );
});

test("the profile goal is bounded to 20-400 kg", () => {
  for (const value of ["20", "400"]) {
    assert.equal(
      profileSchema.parse({ timezone: "Asia/Kolkata", goalWeightKg: value }).goalWeightKg,
      Number(value),
    );
  }

  for (const value of ["0", "19.99", "400.01"]) {
    assert.equal(
      issueMessage(
        profileSchema.safeParse({ timezone: "Asia/Kolkata", goalWeightKg: value }),
        "goalWeightKg",
      ),
      "Weight must be between 20 kg and 400 kg.",
    );
  }
});

test("profileSchema trims the timezone and rejects blank or unknown zones", () => {
  assert.equal(
    profileSchema.parse({ timezone: " Asia/Kolkata " }).timezone,
    "Asia/Kolkata",
  );
  assert.equal(
    issueMessage(profileSchema.safeParse({ timezone: "" }), "timezone"),
    "Choose a timezone.",
  );
  assert.equal(
    issueMessage(profileSchema.safeParse({ timezone: "Not/AZone" }), "timezone"),
    "Choose a valid timezone.",
  );
});

test("createHabitSchema trims the name and rejects a blank one with the production message", () => {
  assert.equal(createHabitSchema.parse({ name: "  Read  " }).name, "Read");

  for (const name of ["", "   "]) {
    assert.equal(
      issueMessage(createHabitSchema.safeParse({ name }), "name"),
      "Give the habit a name.",
    );
  }
});

test("isValidTimeZone accepts canonical names and links, rejects garbage", () => {
  assert.equal(isValidTimeZone("Asia/Kolkata"), true);
  assert.equal(isValidTimeZone("Asia/Calcutta"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("logSetSchema treats a blank catalog id as free-typed, and keeps a real one", () => {
  // An empty hidden input is "no link"; an absent key stays undefined (the
  // action collapses both with `?? null`).
  assert.equal(logSetSchema.parse({ ...validLogSet, exerciseId: "" }).exerciseId, null);
  assert.equal(logSetSchema.parse(validLogSet).exerciseId, undefined);

  assert.equal(
    logSetSchema.parse({ ...validLogSet, exerciseId: " clx0abc " }).exerciseId,
    "clx0abc",
  );

  // 41 chars exceeds the cuid bound: rejected on the field, not silently cut.
  assert.equal(
    issueMessage(
      logSetSchema.safeParse({ ...validLogSet, exerciseId: "a".repeat(41) }),
      "exerciseId",
    ),
    "That exercise is no longer in the library.",
  );
});
