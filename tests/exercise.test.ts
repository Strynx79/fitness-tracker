import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveExerciseKey, pickTopSet } from "@/lib/exercise";

test("deriveExerciseKey trims, collapses whitespace and lowercases", () => {
  assert.equal(deriveExerciseKey("  Bench   Press  "), "bench press");
  assert.equal(deriveExerciseKey("Bench\t\tPress"), "bench press");
  assert.equal(deriveExerciseKey("Bench \n Press"), "bench press");
  assert.equal(deriveExerciseKey("BENCH PRESS"), "bench press");
});

test("deriveExerciseKey maps display variants of one lift to the same key", () => {
  const variants = ["Bench Press", "bench  press", " BENCH PRESS ", "Bench\tPress"];
  const keys = new Set(variants.map(deriveExerciseKey));

  assert.deepEqual([...keys], ["bench press"]);
});

test("pickTopSet picks the heaviest weight", () => {
  const sets = [
    { weightKg: 90, reps: 5, setNumber: 1 },
    { weightKg: 85, reps: 6, setNumber: 2 },
    { weightKg: 80, reps: 8, setNumber: 3 },
  ];

  assert.equal(pickTopSet(sets)?.weightKg, 90);
});

test("pickTopSet breaks a weight tie with more reps", () => {
  const sets = [
    { weightKg: 80, reps: 8, setNumber: 1 },
    { weightKg: 80, reps: 10, setNumber: 2 },
  ];

  assert.equal(pickTopSet(sets)?.reps, 10);
});

test("pickTopSet breaks a weight and rep tie with the lowest set number", () => {
  const sets = [
    { weightKg: 80, reps: 8, setNumber: 3 },
    { weightKg: 80, reps: 8, setNumber: 1 },
    { weightKg: 80, reps: 8, setNumber: 2 },
  ];

  assert.equal(pickTopSet(sets)?.setNumber, 1);
});

test("weightKg 0 is a real bodyweight value, not missing", () => {
  assert.equal(
    pickTopSet([
      { weightKg: 0, reps: 10, setNumber: 1 },
      { weightKg: 0, reps: 8, setNumber: 2 },
    ])?.reps,
    10,
  );

  assert.equal(
    pickTopSet([
      { weightKg: 0, reps: 12, setNumber: 1 },
      { weightKg: 2.5, reps: 8, setNumber: 2 },
    ])?.weightKg,
    2.5,
  );
});

test("pickTopSet returns null for an empty array", () => {
  assert.equal(pickTopSet([]), null);
});

test("pickTopSet does not mutate its input", () => {
  const sets = [
    { weightKg: 85, reps: 6, setNumber: 1, id: "a" },
    { weightKg: 90, reps: 5, setNumber: 2, id: "b" },
  ];
  const snapshot = sets.map((set) => ({ ...set }));

  const top = pickTopSet(sets);

  assert.equal(top?.id, "b");
  assert.deepEqual(sets, snapshot);
  assert.equal(sets[0]?.weightKg, 85);
  assert.equal(sets[1]?.weightKg, 90);
});
