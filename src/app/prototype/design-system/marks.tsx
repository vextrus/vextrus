/**
 * PROTOTYPE — ticket 10. The non-colour channel.
 *
 * `quantity-contract.md` §6: the certificate rides every export channel and is
 * **never carried by colour alone** — a tint dies in greyscale and print. So
 * every status in this prototype is a triple: a glyph, a word, and (only then)
 * a colour. Flip the switcher's `mono` toggle to read any variant with colour
 * stripped; nothing may become unreadable.
 */

import type { BasisValue, Coverage, QueueKind, RefusalCause } from "./fixtures";

/** Glyphs are chosen to survive a fax: solid = read, hollow = guessed, dash = nobody looked. */
const basisGlyph: Record<BasisValue, string> = {
  MEASURED: "■",
  TRANSCRIBED: "❝",
  DERIVED: "ƒ",
  IMPORTED: "⇥",
  ENTERED: "✎",
  INTERPRETED: "◇",
  DEFAULTED: "—",
};

const basisTone: Record<BasisValue, string> = {
  MEASURED: "var(--proto-strong)",
  TRANSCRIBED: "var(--proto-strong)",
  DERIVED: "var(--proto-caution)",
  IMPORTED: "var(--proto-caution)",
  ENTERED: "var(--proto-caution)",
  INTERPRETED: "var(--proto-weak)",
  DEFAULTED: "var(--proto-refuse)",
};

export function BasisMark({ basis, label }: { basis: BasisValue; label?: string }) {
  return (
    <span
      className="inline-flex items-baseline gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em]"
      style={{ color: basisTone[basis] }}
      title={label}
    >
      <span aria-hidden>{basisGlyph[basis]}</span>
      <span>{basis}</span>
    </span>
  );
}

/**
 * Coverage's mark is a hollow half-square, and the word is never abbreviated:
 * `PARTIAL_DECLARED` on a row means the omissions are enumerated on that row.
 */
export function CoverageMark({ coverage }: { coverage: Coverage }) {
  const partial = coverage === "PARTIAL_DECLARED";
  return (
    <span
      className="inline-flex items-baseline gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em]"
      style={{ color: partial ? "var(--proto-weak)" : "var(--proto-strong)" }}
    >
      <span aria-hidden>{partial ? "◧" : "■"}</span>
      <span>{coverage}</span>
    </span>
  );
}

/** A refusal always carries its cause; the cause is the enum, never the note. */
export function CauseMark({ cause }: { cause: RefusalCause }) {
  const humanOnly = cause === "NOT_IN_PROJECT_SCOPE" || cause === "NOT_IN_THIS_BILL";
  return (
    <span
      className="inline-flex items-baseline gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em]"
      style={{ color: "var(--proto-refuse)" }}
    >
      <span aria-hidden>{humanOnly ? "✋" : "⊘"}</span>
      <span>{cause}</span>
    </span>
  );
}

export const queueKindLabel: Record<QueueKind, string> = {
  DISCIPLINE: "discipline",
  SCALE: "scale",
  GEOREFERENCE: "georeference",
  TRANSCRIPTION: "transcription",
  LEVEL_CARRY: "level",
  DISCREPANCY: "discrepancy",
  SCOPE: "scope",
};

/**
 * Blocking is structural, not decorative: a bar on the leading edge plus the
 * word. In mono it still reads, which is the whole point of the rule.
 */
export function BlockingMark({ blocking }: { blocking: boolean }) {
  return blocking ? (
    <span
      className="inline-flex items-baseline gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em]"
      style={{ color: "var(--proto-refuse)" }}
    >
      <span aria-hidden>▮</span>
      <span>blocks ingestion</span>
    </span>
  ) : null;
}

/** Tabular figures: a column of quantities must align on the decimal or it cannot be scanned. */
export const figures = "font-mono [font-variant-numeric:tabular-nums]";
