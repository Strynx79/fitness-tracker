/**
 * The results ledger's column tracks, shared by the header row, every result row
 * and the loading skeleton.
 *
 * The name column absorbs the canvas; equipment, target and the catalog number
 * get fixed tracks so their figures land in the same place on every line — a
 * name-only row stretched across the full canvas is what leaves a half-screen
 * void. The phone keeps two tracks (name, number) and carries equipment/target
 * in the subline instead. One const, so the skeleton cannot drift from the real
 * geometry and resize the columns when the data lands.
 */
export const LEDGER_COLUMNS =
  "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_160px_56px] lg:grid-cols-[minmax(0,1fr)_140px_180px_60px] xl:grid-cols-[minmax(0,1fr)_160px_210px_64px]";
