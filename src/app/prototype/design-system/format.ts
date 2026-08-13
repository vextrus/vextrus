/**
 * PROTOTYPE — throwaway. Number rendering for the design-system prototype.
 *
 * Lakh/crore grouping, hand-rolled: `toLocaleString` is banned (CLAUDE.md), and
 * an `Intl` grouping would resolve against the runtime's ICU build anyway. The
 * real implementation lands with the bill renderer, not here.
 */

export type Lang = "en" | "bn";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** 12345678.9 -> "1,23,45,678.9" — last three, then pairs. */
function groupLakh(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const head = intPart.slice(0, -3);
  const tail = intPart.slice(-3);
  const pairs: string[] = [];
  let rest = head;
  while (rest.length > 2) {
    pairs.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) pairs.unshift(rest);
  return `${pairs.join(",")},${tail}`;
}

function toBnDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const d = ch.charCodeAt(0) - 48;
    out += d >= 0 && d <= 9 ? BN_DIGITS[d] : ch;
  }
  return out;
}

/**
 * A quantity, at a fixed per-kind precision. Documents round *before*
 * extension (quantity-contract §6); the register keeps full precision, so this
 * is a rendering concern only — the value is passed in as a string to keep the
 * prototype honest about never touching a float on the way to a document.
 */
export function qty(value: string, dp: number, lang: Lang = "en"): string {
  const neg = value.startsWith("-");
  const [i = "0", f = ""] = (neg ? value.slice(1) : value).split(".");
  // string-only rounding: the prototype never parses a quantity to a float
  const frac = (f + "0".repeat(dp)).slice(0, dp);
  const body = dp > 0 ? `${groupLakh(i)}.${frac}` : groupLakh(i);
  const s = neg ? `-${body}` : body;
  return lang === "bn" ? toBnDigits(s) : s;
}

/** An integer count — same grouping, no decimals. */
export function count(n: number, lang: Lang = "en"): string {
  return qty(String(n), 0, lang);
}

/**
 * Compact lakh/crore. Screen chrome ONLY — `CLAUDE.md` bans `L`/`Cr` on a
 * document, which is exactly why the prototype renders it in a dashboard tile
 * and never inside the bill or the certificate. Seeing both on one screen is
 * the point.
 */
export function compactScreenOnly(n: number, lang: Lang = "en"): string {
  const unit = lang === "bn" ? { cr: " কোটি", l: " লক্ষ" } : { cr: " Cr", l: " L" };
  if (n >= 10_000_000) return qty((n / 10_000_000).toFixed(2), 2, lang) + unit.cr;
  if (n >= 100_000) return qty((n / 100_000).toFixed(2), 2, lang) + unit.l;
  return count(n, lang);
}
