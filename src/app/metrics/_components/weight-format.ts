/**
 * Number formatting for the metrics screen.
 *
 * Weights are stored to two decimals, but every figure on this screen is read
 * at a glance between sets, so one decimal is the house precision. `Intl`
 * supplies the thousands separator if a figure ever reaches 1,000 (it will not
 * for a body weight, but the formatter is shared with the change columns).
 */
const KG = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `79.8` → "79.8"; `1024.25` → "1,024.3". Always exactly one decimal. */
export function formatKg(value: number): string {
  return KG.format(value);
}

/**
 * A signed change: "+2.4", "−0.4", or "0.0".
 *
 * The minus is U+2212 rather than a hyphen so it lines up with the plus at the
 * same width in a tabular column. Values that round to zero lose the sign
 * entirely: a "−0.0" would claim a direction that the displayed precision
 * cannot show.
 */
export function formatSignedKg(value: number): string {
  const rounded = Number(value.toFixed(1));

  if (rounded === 0) {
    return KG.format(0);
  }

  return `${rounded > 0 ? "+" : "−"}${KG.format(Math.abs(rounded))}`;
}

/** The same rounding rule as the formatters, for choosing a colour. */
export function roundTenths(value: number): number {
  return Number(value.toFixed(1));
}
