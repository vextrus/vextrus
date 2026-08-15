/**
 * PROTOTYPE — ticket 10. One screen in Bangla (genesis §5), prototyped now
 * rather than after the type scale is set, because Bangla is not a string
 * swap:
 *
 *  - The matra (the head-line) means glyphs hang *below* a solid bar, so a
 *    1.3 Latin line-height crowds; this panel runs 1.65 and still reads tight.
 *  - Bangla conjuncts stack vertically — a 13px data row that is comfortable in
 *    Latin loses conjunct detail, so Bangla prose steps up one size while the
 *    *figures* stay on the Latin data size.
 *  - **Numerals stay Western on a document, in both languages.** Bengali
 *    numerals are offered nowhere here on purpose: a signed bill is read by two
 *    parties, and a quantity that renders differently per reader's locale is a
 *    second number. Grouping stays lakh/crore in both — that is a grouping
 *    convention, not a glyph set.
 */

import { formatTaka } from "./format";
import { bn, exclusions, measuredScopeSubtotal, project } from "./fixtures";

export function BanglaCertificate({ tone = "paper" }: { tone?: "paper" | "viewport" }) {
  const paper = tone === "paper";
  return (
    <section
      lang="bn"
      className="mx-auto max-w-[78rem] px-8 py-6"
      style={{
        lineHeight: 1.7,
        fontSize: "1rem", // Bangla steps up one size; the figures below stay on the Latin data size
        fontFamily: '"Noto Sans Bengali", "Hind Siliguri", ui-sans-serif, sans-serif',
        color: paper ? "#1c1a17" : "#e8e4dc",
      }}
    >
      <header className="mb-3 border-b pb-2" style={{ borderColor: paper ? "#ddd6ca" : "#3a3833" }}>
        <h2 className="text-xl font-semibold">{bn.certificate}</h2>
        <p className="text-[0.9375rem] opacity-70">
          {bn.project} · {bn.bill}
        </p>
      </header>

      <p className="max-w-[70ch]">{bn.scopeStatement}</p>

      <h3 className="mt-5 mb-1 font-semibold">{bn.excludedHeading}</h3>
      <ul className="space-y-1.5">
        {exclusions.map((e) => (
          <li key={`${e.elementClass}-${e.quantityKind}`} className="flex flex-wrap items-baseline gap-x-2 text-[0.9375rem]">
            <span aria-hidden className="opacity-60">
              ⊘
            </span>
            <span className="font-mono text-[0.75rem]" lang="en">
              {e.elementClass} × {e.quantityKind}
            </span>
            <span className="opacity-80">— {bn.causeLabels[e.cause]}</span>
            {e.actor && (
              <span className="opacity-60" lang="en">
                · {e.actor}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p
        className="mt-5 max-w-[70ch] border-l-2 pl-3"
        style={{ borderColor: paper ? "#a34a1f" : "#ff9a5c" }}
      >
        {bn.disclosure}
      </p>

      <div
        className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t pt-3"
        style={{ borderColor: paper ? "#ddd6ca" : "#3a3833" }}
      >
        <span>{bn.subtotalLabel}</span>
        <span className="font-mono text-lg [font-variant-numeric:tabular-nums]" lang="en">
          {formatTaka(measuredScopeSubtotal)}
        </span>
      </div>
      <p className="mt-1 text-[0.8125rem] opacity-70">{bn.noGrandTotal}</p>
      <p className="mt-8">
        {bn.signature}: <span lang="en">{project.surveyor}</span>
      </p>
    </section>
  );
}
