import "server-only";

/**
 * The list a timezone `<select>` renders.
 *
 * `Intl.supportedValuesOf("timeZone")` returns canonical names only, so it omits
 * aliases such as `Asia/Kolkata` (canonical: `Asia/Calcutta`). A stored value
 * that is not in the list would render as an empty/blank option — the form would
 * appear to have lost the user's setting. Callers pass the value currently saved
 * on the profile so it is always present in the options.
 *
 * Server-only: the select receives this list as a serialized prop. Client
 * Components must not import this module — browser ICU data can differ from the
 * server's, so the option list is computed once on the server and passed down.
 */
export function listTimezones(includeValue?: string): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));

  // Trim first: a stored `" UTC"` would otherwise add a whitespace-padded option
  // that does not match the canonical `"UTC"` entry. Blanks are not "set": an
  // empty `includeValue` (e.g. a user with no profile row yet) must not add an
  // empty option to the list.
  const value = includeValue?.trim();
  if (value !== undefined && value !== "") {
    zones.add(value);
  }

  // `Set` removes the duplicate when `includeValue` is canonical already.
  return [...zones].sort();
}
