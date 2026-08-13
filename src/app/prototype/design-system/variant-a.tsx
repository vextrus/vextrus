/**
 * PROTOTYPE — ticket 10, Variant A: "Drafting Table".
 *
 * Canvas and worklist as persistent equal partners, split left/right — the
 * drawing never shrinks to a thumbnail while the queue is worked. Paper-toned
 * surface, serif document heading, dense tabular data. The winning direction
 * (see the ticket's Build note).
 */

import { formatTaka } from "@/core/format";
import { CanvasMock } from "./canvas-mock";
import { billLines, exclusion, interpretedDisclosure, measuredScopeSubtotal, banglaScreen } from "./fixtures";
import { BasisBadge, CoverageBadge } from "./status-badge";

export function VariantA() {
  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: "var(--color-surface)", color: "var(--color-ink)" }}
    >
      <header
        className="flex items-baseline justify-between border-b px-6 py-3"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <h1 className="font-serif text-xl tracking-tight">Vextrus — Structural, Level 2</h1>
        <p className="text-[length:var(--font-size-label)] uppercase tracking-wide" style={{ color: "var(--color-ink-muted)" }}>
          Project: Uttara Tower B · Rahman & Associates
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <section
          className="flex w-[58%] flex-col border-r p-4"
          style={{ borderColor: "var(--color-rule)", background: "var(--color-canvas-frame)" }}
        >
          <div className="mb-2 flex items-center justify-between text-[length:var(--font-size-label)] uppercase tracking-wide text-[color:#cfc7b5]">
            <span>S-101 rev C — Structural — Level 2</span>
            <span>Scale 1:100 · affirmed</span>
          </div>
          <div className="min-h-0 flex-1 rounded-sm bg-[#f2efe6] p-2">
            <CanvasMock tone="light" />
          </div>
        </section>

        <section className="flex w-[42%] flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-[var(--spacing-row-loose)]" style={{ borderColor: "var(--color-rule)" }}>
            <h2 className="font-serif text-base">Bill — measured scope</h2>
            <span className="text-[length:var(--font-size-label)] uppercase tracking-wide" style={{ color: "var(--color-ink-muted)" }}>
              4 lines
            </span>
          </div>

          <table className="w-full border-collapse text-[length:var(--font-size-data)]">
            <thead>
              <tr
                className="border-b text-left text-[length:var(--font-size-label)] uppercase tracking-wide"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-muted)" }}
              >
                <th className="px-4 py-1 font-normal">Mark</th>
                <th className="px-2 py-1 font-normal">Kind</th>
                <th className="px-2 py-1 text-right font-normal">Qty</th>
                <th className="px-2 py-1 font-normal">Basis</th>
                <th className="px-2 py-1 font-normal">Coverage</th>
                <th className="px-4 py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {billLines.map((line) => (
                <tr key={line.mark + line.kind} className="border-b" style={{ borderColor: "var(--color-rule)" }}>
                  <td className="h-[var(--spacing-row)] px-4">{line.mark}</td>
                  <td className="px-2">
                    {line.kind} · {line.unit}
                  </td>
                  <td className="px-2 text-right">{line.quantity}</td>
                  <td className="px-2">
                    <BasisBadge basis={line.quantityBasis} />
                  </td>
                  <td className="px-2">
                    <CoverageBadge coverage={line.coverage} />
                  </td>
                  <td className="px-4 text-right">
                    {line.amount ? formatTaka(line.amount) : <span style={{ color: "var(--color-ink-muted)" }}>unpriced</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mx-4 my-3 rounded-sm border px-3 py-2 text-[length:var(--font-size-data)]" style={{ borderColor: "var(--color-status-excluded)" }}>
            <p className="font-mono" style={{ color: "var(--color-status-excluded)" }}>
              ▢ excluded — {exclusion.elementClass} × {exclusion.kind}
            </p>
            <p style={{ color: "var(--color-ink-muted)" }}>
              {exclusion.cause} · {exclusion.actor} — {exclusion.note}
            </p>
          </div>

          <div className="mx-4 my-1 border-l-2 px-3 py-2 text-[length:var(--font-size-data)]" style={{ borderColor: "var(--color-status-interpreted)" }}>
            <p>△ {interpretedDisclosure.statement}</p>
          </div>

          <div className="mt-auto border-t px-4 py-3" style={{ borderColor: "var(--color-rule)" }}>
            <p className="text-[length:var(--font-size-label)] uppercase tracking-wide" style={{ color: "var(--color-ink-muted)" }}>
              Measured-scope subtotal
            </p>
            <p className="font-serif text-2xl">{formatTaka(measuredScopeSubtotal)}</p>
          </div>

          <div
            className="mx-4 mb-4 rounded-sm p-3"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-rule)", lineHeight: "var(--line-height-bangla)" }}
            lang="bn"
          >
            <p className="font-sans text-base" style={{ fontFamily: "var(--font-sans-bangla)" }}>
              {banglaScreen.heading}
            </p>
            <p className="mt-1 text-[length:var(--font-size-data)]" style={{ fontFamily: "var(--font-sans-bangla)" }}>
              {banglaScreen.statement}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
