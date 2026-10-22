/** Keeps digits and one decimal point (max two decimals), dropping leading zeros. */
export function cleanAmountText(raw: string): string {
  let text = raw.replace(/[^\d.]/g, "");
  const dot = text.indexOf(".");
  if (dot !== -1) {
    text = text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  }
  return text.replace(/^0+(?=\d)/, "");
}

/** Adds a comma every three digits: "1000000.2" -> "1,000,000.2". */
export function groupAmountText(clean: string): string {
  const [whole, decimals] = clean.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped || "0"}.${decimals}`;
}

export function formatAmountText(raw: string): string {
  return groupAmountText(cleanAmountText(raw));
}

/** Parses typed text back to a number; empty text gives `emptyValue`. */
export function parseAmountText(text: string, emptyValue = Number.NaN): number {
  const clean = text.replace(/,/g, "");
  return clean === "" || clean === "." ? emptyValue : Number(clean);
}

/** Text to show for a stored amount; zero and invalid show as empty. */
export function amountToText(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value === 0) return "";
  return formatAmountText(value.toFixed(2).replace(/\.?0+$/, ""));
}

/**
 * Where the caret belongs after reformatting: just after the same number of
 * digits (and decimal point) that were before it in the raw text.
 */
export function caretAfterFormat(raw: string, rawCaret: number, formatted: string): number {
  const significantBefore = cleanAmountText(raw.slice(0, rawCaret)).length;
  let position = 0;
  let seen = 0;
  while (position < formatted.length && seen < significantBefore) {
    if (formatted[position] !== ",") seen += 1;
    position += 1;
  }
  return position;
}
