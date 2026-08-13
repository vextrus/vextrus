/**
 * Document presentation of money and quantity. Locality is data and config
 * (ADR-0006) — but *documents own presentation*, and lakh/crore grouping is
 * named there as a document convention. This is that convention's single
 * declaration site: the disposition queue, the bill, and the server-generated
 * PDF each need it, and only `src/core` is importable by all of them
 * (`eslint.config.js` bans cross-module deep imports), so the spine holds it
 * rather than three call sites re-typing a grouping rule (genesis F6).
 *
 * Decimal strings in, strings out — never a float for money or a quantity
 * (CLAUDE.md), and never `toLocaleString('en-US')`, whose Western K/M grouping
 * is banned. Compact `L`/`Cr` is not implemented at all: it may never appear on
 * a document (`quantity-contract.md` §6), and the cheapest way to keep it off
 * one is to have no function that produces it.
 */

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/** The Bangladeshi/Indian grouping: last three digits, then twos, right to left. */
function groupLakhCrore(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  return `${groups.join(",")},${last3}`;
}

function parse(value: string): { sign: string; whole: string; fraction: string | undefined } {
  if (typeof value !== "string") {
    throw new TypeError("format takes a decimal string — a float has already lost the money");
  }
  const match = DECIMAL.exec(value.trim());
  if (!match) throw new Error(`not a decimal string: ${JSON.stringify(value)}`);
  const [, sign = "", whole = "", fraction] = match;
  return { sign, whole, fraction };
}

/**
 * `৳1,67,44,725.75`. `fractionDigits` is the per-kind fixed precision the
 * document applies *before* extension (§6); the register keeps full precision
 * and the over-measurement block reads the register value, never this one.
 */
export function formatTaka(amount: string, fractionDigits = 2): string {
  const { sign, whole, fraction } = parse(amount);
  return `${sign}৳${groupLakhCrore(whole)}${fixed(fraction, fractionDigits)}`;
}

/** A quantity: grouped the same way, but no currency mark and a per-kind precision. */
export function formatQuantity(quantity: string, fractionDigits: number): string {
  const { sign, whole, fraction } = parse(quantity);
  return `${sign}${groupLakhCrore(whole)}${fixed(fraction, fractionDigits)}`;
}

/**
 * Truncate-or-pad, never round-half-up in the formatter: rounding is the
 * document's arithmetic decision (applied before extension), not the string
 * layer's, and a formatter that quietly rounds hides a precision mismatch.
 */
function fixed(fraction: string | undefined, digits: number): string {
  if (digits < 0 || !Number.isInteger(digits)) {
    throw new RangeError(`fractionDigits must be a non-negative integer: ${digits}`);
  }
  const source = fraction ?? "";
  if (source.length > digits) {
    throw new Error(
      `value carries ${source.length} decimal places but the document declares ${digits} — round before formatting, never inside it`,
    );
  }
  return digits === 0 ? "" : `.${source.padEnd(digits, "0")}`;
}
