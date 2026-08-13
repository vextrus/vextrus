/** PROTOTYPE — ticket 10. Status is never colour-alone (quantity-contract.md §6): every badge pairs a glyph with its colour. */

import type { BasisValue, Coverage } from "./fixtures";

const basisGlyph: Record<BasisValue, string> = {
  MEASURED: "●", // filled circle — read from geometry
  TRANSCRIBED: "✎", // pencil-ish
  DERIVED: "ƒ", // f(x)
  IMPORTED: "→", // arrow in
  ENTERED: "⌨", // keyboard
  INTERPRETED: "△", // open triangle — a guess, not a reading
  DEFAULTED: "–", // dash — nobody looked
};

const basisColor: Record<BasisValue, string> = {
  MEASURED: "var(--color-status-measured)",
  TRANSCRIBED: "var(--color-status-measured)",
  DERIVED: "var(--color-status-derived)",
  IMPORTED: "var(--color-status-derived)",
  ENTERED: "var(--color-status-derived)",
  INTERPRETED: "var(--color-status-interpreted)",
  DEFAULTED: "var(--color-status-excluded)",
};

export function BasisBadge({ basis }: { basis: BasisValue }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[length:var(--font-size-label)] uppercase tracking-wide"
      style={{ color: basisColor[basis] }}
    >
      <span aria-hidden>{basisGlyph[basis]}</span>
      {basis}
    </span>
  );
}

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  const partial = coverage === "PARTIAL_DECLARED";
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[length:var(--font-size-label)] uppercase tracking-wide"
      style={{ color: partial ? "var(--color-status-interpreted)" : "var(--color-status-measured)" }}
    >
      <span aria-hidden>{partial ? "◐" : "●"}</span>
      {coverage}
    </span>
  );
}
