/**
 * PROTOTYPE — ticket 10, Variant B: "Instrument Console".
 *
 * Canvas as a full-width hero band, dense table stacked below — a technical,
 * cockpit-style register. The losing direction: closer to the legacy
 * disposition surface's "mechanical" feel than Variant A (see Build note).
 */

import { formatTaka } from "@/core/format";
import { CanvasMock } from "./canvas-mock";
import { billLines, exclusion, interpretedDisclosure, measuredScopeSubtotal, banglaScreen } from "./fixtures";
import { BasisBadge, CoverageBadge } from "./status-badge";

export function VariantB() {
  return (
    <div className="flex h-screen flex-col bg-[#15130f] text-[#e8e2d4]">
      <header className="flex items-center justify-between border-b border-[#3a3527] px-6 py-2">
        <h1 className="font-mono text-sm uppercase tracking-widest text-amber-400">VEXTRUS // STRUCTURAL · L2</h1>
        <p className="font-mono text-[length:var(--font-size-label)] text-[#8a8371]">UTTARA TOWER B</p>
      </header>

      <section className="h-[46%] border-b border-[#3a3527] bg-[#0e0d0a] p-3">
        <div className="mb-1 flex justify-between font-mono text-[length:var(--font-size-label)] uppercase tracking-wide text-[#8a8371]">
          <span>S-101 REV C · AFFIRMED SCALE 1:100</span>
          <span className="text-cyan-400">LIVE</span>
        </div>
        <div className="h-[calc(100%-1.25rem)]">
          <CanvasMock tone="dark" />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <table className="w-full border-collapse font-mono text-[length:var(--font-size-data)]">
          <thead className="sticky top-0 bg-[#15130f]">
            <tr className="border-b border-[#3a3527] text-left text-[length:var(--font-size-label)] uppercase tracking-widest text-[#8a8371]">
              <th className="px-4 py-1 font-normal">Mark</th>
              <th className="px-2 py-1 font-normal">Kind</th>
              <th className="px-2 py-1 text-right font-normal">Qty</th>
              <th className="px-2 py-1 font-normal">Basis</th>
              <th className="px-2 py-1 font-normal">Coverage</th>
              <th className="px-4 py-1 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {billLines.map((line) => (
              <tr key={line.mark + line.kind} className="border-b border-[#241f16] hover:bg-[#1c1913]">
                <td className="h-[var(--spacing-row)] px-4 text-cyan-300">{line.mark}</td>
                <td className="px-2 text-[#c9c2af]">
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
                  {line.amount ? formatTaka(line.amount) : <span className="text-[#6b6459]">unpriced</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mx-4 my-3 border border-[#8a3b3b] px-3 py-2 text-[length:var(--font-size-data)]">
          <p className="text-[#c9776b]">▢ EXCLUDED — {exclusion.elementClass} × {exclusion.kind}</p>
          <p className="text-[#8a8371]">
            {exclusion.cause} · {exclusion.actor} — {exclusion.note}
          </p>
        </div>

        <div className="mx-4 border-l-2 border-[#a34a1f] px-3 py-2 text-[length:var(--font-size-data)] text-[#c9a06b]">
          <p>△ {interpretedDisclosure.statement}</p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[#3a3527] px-4 py-3">
          <span className="font-mono text-[length:var(--font-size-label)] uppercase tracking-widest text-[#8a8371]">
            Measured-scope subtotal
          </span>
          <span className="font-mono text-2xl text-amber-300">{formatTaka(measuredScopeSubtotal)}</span>
        </div>

        <div className="mx-4 mb-4 border border-[#3a3527] p-3" style={{ lineHeight: "var(--line-height-bangla)" }} lang="bn">
          <p style={{ fontFamily: "var(--font-sans-bangla)" }}>{banglaScreen.heading}</p>
          <p className="mt-1 text-[length:var(--font-size-data)] text-[#c9c2af]" style={{ fontFamily: "var(--font-sans-bangla)" }}>
            {banglaScreen.statement}
          </p>
        </div>
      </section>
    </div>
  );
}
