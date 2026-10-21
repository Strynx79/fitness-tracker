"use client";

import { useEffect } from "react";

/**
 * Root layout failures replace the whole document, so global CSS is not
 * guaranteed to be present and Tailwind classes cannot be relied on here.
 * Styles are therefore inline and theme-aware via `prefers-color-scheme`,
 * matching the app's neutral palette without depending on its tokens.
 */
const STYLES = `
  :root { color-scheme: light dark; }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: #ffffff;
    color: #171717;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .ge-main {
    display: flex;
    min-height: 100dvh;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
  }
  .ge-card {
    width: 100%;
    max-width: 28rem;
    padding: 24px;
    border: 1px solid #e5e5e5;
    border-radius: 14px;
    background: #ffffff;
  }
  .ge-eyebrow {
    margin: 0 0 8px;
    color: #737373;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .ge-title {
    margin: 0 0 8px;
    font-size: 1.25rem;
    line-height: 1.3;
  }
  .ge-copy {
    margin: 0 0 20px;
    color: #525252;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .ge-button {
    display: inline-flex;
    width: 100%;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 10px;
    background: #171717;
    color: #ffffff;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  .ge-button:focus-visible {
    outline: 3px solid #a3a3a3;
    outline-offset: 2px;
  }
  .ge-link {
    display: inline-flex;
    width: 100%;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    border-radius: 10px;
    color: #171717;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }
  .ge-link:focus-visible {
    outline: 3px solid #a3a3a3;
    outline-offset: 2px;
  }
  .ge-digest {
    margin: 12px 0 0;
    color: #737373;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    text-align: center;
    overflow-wrap: anywhere;
    user-select: all;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0a0a0a; color: #fafafa; }
    .ge-card { border-color: #262626; background: #171717; }
    .ge-eyebrow { color: #a3a3a3; }
    .ge-copy { color: #a3a3a3; }
    .ge-button { background: #fafafa; color: #171717; }
    .ge-button:focus-visible { outline-color: #525252; }
    .ge-link { color: #fafafa; }
    .ge-link:focus-visible { outline-color: #525252; }
    .ge-digest { color: #a3a3a3; }
  }
`;

function getErrorDigest(error: unknown): string | null {
  if (!(error instanceof Error) || !("digest" in error)) return null;

  const { digest } = error;
  return typeof digest === "string" && digest.length > 0 ? digest : null;
}

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest = getErrorDigest(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    // global-error replaces the root layout, so it must provide the document.
    <html lang="en">
      <body>
        <title>Something went wrong · Fitness OS</title>
        <style>{STYLES}</style>

        <main className="ge-main">
          <div className="ge-card">
            <p className="ge-eyebrow">Fitness OS</p>
            <h1 className="ge-title">Something went wrong</h1>
            <p className="ge-copy">
              The app could not load. Try again — if that does not work, reload
              the page from the home screen.
            </p>

            <button
              type="button"
              className="ge-button"
              onClick={() => retry()}
            >
              Try again
            </button>

            {/* A plain anchor forces a full document load, which is the point
                when the root layout itself is the thing that failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="ge-link" href="/">
              Back to home
            </a>

            {digest ? <p className="ge-digest">Reference: {digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
