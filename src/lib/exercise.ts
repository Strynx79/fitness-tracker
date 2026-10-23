/**
 * Pure exercise helpers.
 *
 * Kept free of `server-only` and Prisma so the canonicalisation and top-set
 * ranking rules can be unit-tested directly, and so `prisma/seed.ts` (a plain tsx
 * script) can reuse the exact same key derivation as the server action.
 */

/**
 * The canonical exercise key: trim → collapse internal whitespace → lowercase.
 *
 * The display name is stored alongside it exactly as typed, so the UI still shows
 * "Bench Press" and not "bench press", while "Bench Press", "bench  press" and
 * " BENCH PRESS " all resolve to one exercise. That is load-bearing for the
 * "beat your previous session" callout, whose history query is keyed on this.
 */
export function deriveExerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The dataset stores every name in lowercase ("barbell bench press"), which
 * reads like a search query rather than a title. Only the first character is
 * raised: `toLowerCase()` on the rest would mangle "EZ barbell" / "3/4 sit-up".
 */
export function capitalizeExerciseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

/** YouTube ids are 11 chars of base64url: letters, digits, `-` and `_`. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Escape LIKE wildcards in a search term.
 *
 * Prisma's `contains` compiles to a parameterized `LIKE '%term%'`, so there is no
 * injection risk — but Prisma does NOT escape `%` or `_`, which Postgres reads as
 * wildcards. Without this, typing "bench%" matches the entire catalog. Backslash
 * is escaped first so the escapes added afterwards survive.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

/**
 * Pull the video id out of a YouTube URL, or `null` if there is not one.
 *
 * The catalog's `youtubeUrl` column is free text (curated by hand, nullable), so
 * the detail page cannot trust it. Returning `null` rather than a best-effort
 * guess is what makes the page fall back to a search link instead of rendering
 * an iframe pointed at something arbitrary.
 *
 * Accepted shapes, all with or without `www.` / `m.`:
 *   - https://www.youtube.com/watch?v=<id>
 *   - https://youtu.be/<id>
 *   - https://www.youtube.com/shorts/<id>  (also `/embed/` and `/live/`)
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;

  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // A bare id or a half-pasted URL is not something we can embed.
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const fromQuery = parsed.searchParams.get("v");
  if (fromQuery !== null) {
    return YOUTUBE_ID_PATTERN.test(fromQuery) ? fromQuery : null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const [kind, id] = segments;
  if (kind === "embed" || kind === "shorts" || kind === "live") {
    return id !== undefined && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  return null;
}

/**
 * Clamp a requested page into the range that actually exists.
 *
 * Lives here (not in `@/lib/exercises`) so it stays Prisma-free and unit-testable:
 * `exercises.ts` is `server-only`, and importing it from a test would drag the
 * database client — and `DATABASE_URL` — into a DB-free test run.
 *
 * `pageCount` is never 0: an empty result set still has one (empty) page, so the
 * UI can render "Page 1 of 1" instead of dividing by zero. An out-of-range
 * request (page 9 of 3, page 0, or a stale bookmark after filtering) is clamped
 * rather than rejected, so a deep link degrades to the nearest real page instead
 * of throwing or flashing an empty list while data exists.
 */
export function resolvePage(
  requested: number | undefined,
  total: number,
  pageSize: number,
): { page: number; pageCount: number } {
  // Defensive against callers passing raw searchParam numbers: a NaN page, a
  // fractional page or a bogus page size must not reach Prisma's `skip`.
  const size = Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : 1;
  const rowCount = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const pageCount = Math.max(1, Math.ceil(rowCount / size));

  const wanted =
    requested !== undefined && Number.isFinite(requested) ? Math.floor(requested) : 1;

  return { page: Math.min(Math.max(wanted, 1), pageCount), pageCount };
}

/**
 * The top set of a group, without mutating the input.
 *
 * Heaviest `weightKg` wins, then most `reps`, then the lowest `setNumber` (which
 * only matters when two sets are literally identical in weight and reps, and
 * makes the answer deterministic rather than dependent on array order).
 *
 * `weightKg: 0` is a real value (bodyweight), not "missing": it must compete and
 * simply ranks last because it is the lightest. An empty array has no top set and
 * returns `null`.
 */
export function pickTopSet<T extends { weightKg: number; reps: number; setNumber: number }>(
  sets: readonly T[],
): T | null {
  let best: T | null = null;

  for (const candidate of sets) {
    if (best === null) {
      best = candidate;
      continue;
    }

    if (candidate.weightKg !== best.weightKg) {
      if (candidate.weightKg > best.weightKg) best = candidate;
      continue;
    }

    if (candidate.reps !== best.reps) {
      if (candidate.reps > best.reps) best = candidate;
      continue;
    }

    if (candidate.setNumber < best.setNumber) best = candidate;
  }

  return best;
}

/**
 * Split a raw query into the words a name has to contain.
 *
 * Search is order-insensitive because exercise names are: someone types
 * "incline dumbbell press" for "dumbbell incline press" and both describe the
 * same lift. Duplicates are dropped so "press press" does not search twice for
 * something the SQL already requires once.
 */
export function searchTokens(query: string): string[] {
  const normalized = deriveExerciseKey(query);
  if (normalized === "") return [];

  return [...new Set(normalized.split(" "))];
}

/**
 * Order matches by how directly they answer the query.
 *
 * With token matching every result contains all the words, so ranking is what
 * separates "Dumbbell Incline Press" from a longer name that merely contains
 * them: exact name first, then a name starting with the phrase, then the phrase
 * anywhere on a word boundary, then the rest.
 *
 * Ranking only ever sees rows that already contain every token, so the tie-break
 * is simply "shorter name first": a name made of just the typed words ("Dumbbell
 * Incline Press") beats one with extra qualifiers ("Dumbbell Incline Bench Press
 * Machine"), which is the more specific lift.
 */
export function rankExerciseMatches<T extends { nameKey: string }>(
  rows: readonly T[],
  query: string,
): T[] {
  const normalized = deriveExerciseKey(query);
  if (normalized === "") return [...rows];

  const phraseScore = (nameKey: string): number => {
    if (nameKey === normalized) return 0;
    if (nameKey.startsWith(normalized)) return 1;
    if (nameKey.includes(` ${normalized}`)) return 2;
    if (nameKey.includes(normalized)) return 3;
    return 4;
  };

  return [...rows].sort((a, b) => {
    const byPhrase = phraseScore(a.nameKey) - phraseScore(b.nameKey);
    if (byPhrase !== 0) return byPhrase;

    // Shorter names are the more specific lift ("Bench Press" before
    // "Bench Press Machine Decline Wide Grip").
    if (a.nameKey.length !== b.nameKey.length) {
      return a.nameKey.length - b.nameKey.length;
    }

    return a.nameKey.localeCompare(b.nameKey);
  });
}
