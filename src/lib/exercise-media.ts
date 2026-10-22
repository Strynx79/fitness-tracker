/**
 * Exercise media URLs.
 *
 * The images and GIFs are NOT vendored into this repo: they are © Gym visual and
 * the dataset redistributes them under a permission that does not extend to
 * copying them elsewhere. Hotlinking the dataset's raw files keeps this
 * repository free of third-party media while still showing the asset.
 *
 * Consequence to keep in mind: these URLs depend on that public repository, so
 * the UI must render fine when a request 404s (the `<img>` simply fails and the
 * surrounding layout stays intact).
 *
 * Licence-bearing: every surface that shows this media must also show
 * `GYM_VISUAL_ATTRIBUTION` verbatim.
 */
export const EXERCISE_MEDIA_BASE =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main";

export const GYM_VISUAL_ATTRIBUTION = "© Gym visual — https://gymvisual.com/";

/**
 * Turn a stored dataset path (`images/0025-EIeI8Vf.jpg`) into a URL.
 *
 * Returns `null` for anything that is not one of the dataset's two known
 * folders — an absolute URL or a `../` path in the column must never be able to
 * point the `<img>` somewhere else.
 */
export function exerciseMediaUrl(path: string | null | undefined): string | null {
  if (typeof path !== "string") return null;

  const trimmed = path.trim();

  if (!trimmed.startsWith("images/") && !trimmed.startsWith("videos/")) {
    return null;
  }

  return `${EXERCISE_MEDIA_BASE}/${trimmed}`;
}
