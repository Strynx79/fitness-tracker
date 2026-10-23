import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  capitalizeExerciseName,
  deriveExerciseKey,
  escapeLikePattern,
  extractYouTubeId,
  rankExerciseMatches,
  resolvePage,
  searchTokens,
} from "@/lib/exercise";

/**
 * DB-free tests for the catalog slice.
 *
 * `@/lib/exercises` is deliberately not imported: it is `server-only` and pulls
 * in the Prisma client, which would make this suite require `DATABASE_URL`. The
 * paging rule that module depends on lives in `@/lib/exercise` for exactly this
 * reason, and the dataset itself is a JSON file we can read directly.
 */

test("resolvePage clamps page 0 up to the first page", () => {
  assert.deepEqual(resolvePage(0, 100, 24), { page: 1, pageCount: 5 });
});

test("resolvePage clamps an out-of-range page down to the last page", () => {
  // 3 pages of 24 → 72 rows max; page 9 does not exist.
  assert.deepEqual(resolvePage(9, 72, 24), { page: 3, pageCount: 3 });
  assert.deepEqual(resolvePage(9, 100, 24), { page: 5, pageCount: 5 });
});

test("resolvePage keeps an in-range page untouched", () => {
  assert.deepEqual(resolvePage(2, 100, 24), { page: 2, pageCount: 5 });
});

test("resolvePage floors fractional and non-finite input", () => {
  assert.deepEqual(resolvePage(2.9, 100, 24), { page: 2, pageCount: 5 });
  assert.deepEqual(resolvePage(Number.NaN, 100, 24), { page: 1, pageCount: 5 });
  assert.deepEqual(resolvePage(Number.POSITIVE_INFINITY, 100, 24), {
    page: 1,
    pageCount: 5,
  });
  assert.deepEqual(resolvePage(undefined, 100, 24), { page: 1, pageCount: 5 });
});

test("resolvePage reports one empty page when there are no rows", () => {
  assert.deepEqual(resolvePage(undefined, 0, 24), { page: 1, pageCount: 1 });
  assert.deepEqual(resolvePage(7, 0, 24), { page: 1, pageCount: 1 });
});

test("resolvePage handles an exact page boundary without a phantom page", () => {
  // 48 rows at 24/page is exactly 2 pages, not 3.
  assert.deepEqual(resolvePage(2, 48, 24), { page: 2, pageCount: 2 });
  assert.deepEqual(resolvePage(3, 48, 24), { page: 2, pageCount: 2 });
});

test("dataset names normalise to the same key as typed names", () => {
  assert.equal(deriveExerciseKey("Barbell Bench Press"), "barbell bench press");
  assert.equal(deriveExerciseKey("3/4 sit-up"), "3/4 sit-up");
  assert.equal(deriveExerciseKey("  Barbell   Bench  Press "), "barbell bench press");
  assert.equal(
    deriveExerciseKey("Barbell Bench Press") === deriveExerciseKey("barbell bench press"),
    true,
  );
});

/** The fields this suite asserts on; the rest of the record is irrelevant here. */
type CatalogRecord = {
  id: string;
  name: string;
};

const rawCatalog = readFileSync(
  new URL("../prisma/data/exercises.json", import.meta.url),
  "utf8",
);
const parsedCatalog: unknown = JSON.parse(rawCatalog);

// Fail the module (not an obscure per-test crash) if the vendored file is the
// wrong shape: every test below reads it as an array.
if (!Array.isArray(parsedCatalog)) {
  throw new Error("prisma/data/exercises.json must contain a JSON array.");
}

const catalog = parsedCatalog as CatalogRecord[];

test("the vendored dataset is a non-empty array", () => {
  assert.ok(catalog.length > 0);
});

test("the vendored dataset has exactly 1,324 unique 4-digit ids", () => {
  assert.equal(catalog.length, 1_324);

  const ids = new Set<string>();

  for (const record of catalog) {
    assert.match(record.id, /^\d{4}$/, `bad dataset id: ${JSON.stringify(record.id)}`);
    assert.equal(ids.has(record.id), false, `duplicate dataset id: ${record.id}`);
    ids.add(record.id);

    assert.equal(typeof record.name, "string");
    assert.ok(
      record.name.trim().length > 0,
      `empty name for dataset id: ${record.id}`,
    );
  }

  assert.equal(ids.size, catalog.length);
});

test("every dataset name fits the nameKey/name columns and normalises stably", () => {
  for (const record of catalog) {
    const key = deriveExerciseKey(record.name);

    // Both columns are VARCHAR(120); `name` maxes at 67 in this dataset, but the
    // key must also survive the "trim + collapse" rule without growing.
    assert.ok(key.length <= 120, `nameKey too long for ${record.id}`);
    assert.equal(key, key.trim());
    assert.equal(key, deriveExerciseKey(key), `nameKey not idempotent for ${record.id}`);
  }
});

test("extractYouTubeId reads the common watch and short-link shapes", () => {
  assert.equal(
    extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    extractYouTubeId("https://m.youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

test("extractYouTubeId refuses anything it cannot safely embed", () => {
  // No id at all.
  assert.equal(extractYouTubeId("https://www.youtube.com/"), null);
  // A different host, even with a `v` param.
  assert.equal(extractYouTubeId("https://vimeo.com/watch?v=dQw4w9WgXcQ"), null);
  // Wrong id length.
  assert.equal(extractYouTubeId("https://youtu.be/short"), null);
  // A bare id is not a URL.
  assert.equal(extractYouTubeId("dQw4w9WgXcQ"), null);
  // Non-http schemes must never reach an iframe src.
  assert.equal(extractYouTubeId("javascript:alert(1)"), null);
  // Nullable column, unset.
  assert.equal(extractYouTubeId(null), null);
  assert.equal(extractYouTubeId(undefined), null);
  assert.equal(extractYouTubeId("   "), null);
});

test("capitalizeExerciseName raises only the first character", () => {
  assert.equal(capitalizeExerciseName("barbell bench press"), "Barbell bench press");
  assert.equal(capitalizeExerciseName("ez barbell curl"), "Ez barbell curl");
  assert.equal(capitalizeExerciseName("  3/4 sit-up "), "3/4 sit-up");
  assert.equal(capitalizeExerciseName(""), "");
});

test("escapeLikePattern neutralises LIKE wildcards without touching letters", () => {
  assert.equal(escapeLikePattern("bench press"), "bench press");
  // A bare % would otherwise match every row in the catalog.
  assert.equal(escapeLikePattern("bench%"), "bench\\%");
  // `_` is a single-character wildcard.
  assert.equal(escapeLikePattern("b_nch"), "b\\_nch");
  // Backslash first, so the escapes added afterwards are not double-escaped.
  assert.equal(escapeLikePattern("a\\b%"), "a\\\\b\\%");
});

test("searchTokens splits on words, any order, without duplicates", () => {
  assert.deepEqual(searchTokens("Incline  Dumbbell Press"), [
    "incline",
    "dumbbell",
    "press",
  ]);
  assert.deepEqual(searchTokens("press press"), ["press"]);
  assert.deepEqual(searchTokens("   "), []);
});

test("rankExerciseMatches puts the reordered phrase first", () => {
  // The reported case: typing the words in a different order from the dataset
  // name must still surface that exercise, and rank it above other lifts that
  // merely contain the same words.
  // All rows contain every token (that is what the SQL filter guarantees); the
  // ranking decides which of them the user actually meant.
  const rows = [
    { nameKey: "dumbbell incline bench press" },
    { nameKey: "dumbbell incline press" },
  ];

  assert.deepEqual(
    rankExerciseMatches(rows, "incline dumbbell press").map((row) => row.nameKey),
    ["dumbbell incline press", "dumbbell incline bench press"],
  );
});

test("rankExerciseMatches prefers a prefix match over a mid-name match", () => {
  const rows = [
    { nameKey: "cable bench press" },
    { nameKey: "bench press machine" },
    { nameKey: "bench press" },
  ];

  assert.deepEqual(
    rankExerciseMatches(rows, "bench press").map((row) => row.nameKey),
    ["bench press", "bench press machine", "cable bench press"],
  );
});

test("rankExerciseMatches leaves rows untouched without a query", () => {
  const rows = [{ nameKey: "b" }, { nameKey: "a" }];
  assert.deepEqual(rankExerciseMatches(rows, "").map((row) => row.nameKey), ["b", "a"]);
});
