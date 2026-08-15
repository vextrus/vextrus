/**
 * PROTOTYPE — ticket 10, variant B: "Instrument Console".
 *
 * The register: a CAD viewport. Near-black ground, white line work, mono
 * everywhere, panels floating *over* the drawing rather than beside it. The
 * structure: the canvas is the entire screen; the worklist is a translucent
 * dock on the right, the bill a collapsible dock at the bottom. Nothing is
 * ever more than one surface away from the geometry.
 *
 * The claim it makes: this is the tool a drafter already lives in, so it needs
 * no learning. The risk it carries — and the reason it is here to be beaten —
 * is that a dark console of chips and counters is exactly the register the
 * legacy's "mechanical" disposition surface spoke in.
 */

import type { CSSProperties } from "react";
import { formatQuantity, formatTaka } from "./format";
import { BanglaCertificate } from "./bangla-certificate";
import { CanvasMock } from "./canvas-mock";
import {
  absenceSummary,
  billLines,
  bn,
  exclusions,
  interpretedDisclosure,
  measuredScopeSubtotal,
  project,
  queue,
  queueText,
} from "./fixtures";
import { BasisMark, BlockingMark, CauseMark, CoverageMark, figures, queueKindLabel } from "./marks";

const tokens = {
  "--proto-strong": "#5fd3a0",
  "--proto-caution": "#e0b64a",
  "--proto-weak": "#ff9a5c",
  "--proto-refuse": "#ff7a7a",
} as CSSProperties;

const precision: Record<string, number> = { "m³": 3, "m²": 2, kg: 2 };

export function VariantB({ lang }: { lang: "en" | "bn" }) {
  const isBn = lang === "bn";
  return (
    <div
      className="relative h-screen overflow-hidden bg-[#16161a] font-mono text-[0.8125rem] text-[#e8e4dc]"
      style={tokens}
    >
      {/* The canvas is the page, not a panel on it. */}
      <div className="absolute inset-0">
        <CanvasMock tone="viewport" highlight={["C-7", "C-8", "C-11"]} raster showDimensions={false} />
      </div>

      {/* Status strip. */}
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[#2e2e34] bg-[#101013]/85 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-[0.6875rem] tracking-[0.2em] text-[#8a8a94] uppercase">vextrus</span>
          <span>{isBn ? bn.project : project.name}</span>
          <span className="text-[#8a8a94]">{project.drawingSet}</span>
        </div>
        <div className="flex items-center gap-4 text-[0.6875rem] uppercase">
          <span style={{ color: "var(--proto-refuse)" }}>
            <span aria-hidden>▮</span> {queue.filter((q) => q.blocking).length}{" "}
            {isBn ? bn.ui.blocking : "blocking"}
          </span>
          <span style={{ color: "var(--proto-weak)" }}>
            <span aria-hidden>◧</span> coverage incomplete
          </span>
          <span className="text-[#8a8a94]">{project.surveyor}</span>
        </div>
      </header>

      {/* Left tool rail — the drawing tools the domain already requires. */}
      <aside className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded border border-[#2e2e34] bg-[#101013]/85 p-1 backdrop-blur">
        {["⟺", "✎", "#", "⌖", "▦"].map((t, i) => (
          <button
            key={t}
            type="button"
            title={["two-point scale", "trace outline", "count by click", "snap ½ grid", "layers"][i]}
            className="block h-9 w-9 rounded text-lg hover:bg-[#26262c]"
          >
            {t}
          </button>
        ))}
      </aside>

      {/* Right dock — the worklist, over the drawing. */}
      <aside className="absolute top-14 right-3 bottom-56 z-10 flex w-[25rem] flex-col rounded border border-[#2e2e34] bg-[#101013]/92 backdrop-blur">
        <div className="flex items-center justify-between border-b border-[#2e2e34] px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-[#8a8a94]">
          <span>{isBn ? bn.ui.disposition : "disposition queue"}</span>
          <span>
            {queue.length} {isBn ? bn.ui.open : "open"}
          </span>
        </div>
        <ol className="min-h-0 flex-1 overflow-auto">
          {queue.map((item) => {
            const t = queueText(item, lang);
            return (
            <li
              key={item.id}
              className="border-b border-[#232329] px-3 py-2 hover:bg-[#1d1d22]"
              style={
                isBn
                  ? {
                      fontFamily: 'var(--font-bangla, "Noto Sans Bengali"), ui-sans-serif, sans-serif',
                      lineHeight: 1.7,
                    }
                  : undefined
              }
            >
              <div className="flex items-baseline justify-between gap-2 text-[0.6875rem] uppercase tracking-[0.08em]">
                <span className="text-[#8a8a94]">
                  {isBn ? bn.queueKindLabels[item.kind] : queueKindLabel[item.kind]}
                </span>
                <BlockingMark blocking={item.blocking} />
              </div>
              <p className="mt-0.5" style={{ lineHeight: isBn ? 1.7 : 1.2 }}>
                {t.headline}
              </p>
              <p className="mt-1 border-l border-[#3a3a42] pl-2 text-[0.75rem] text-[#a9a9b3]">
                {t.proposal}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[0.75rem]">
                <button
                  type="button"
                  className="h-6 rounded-sm bg-[#e8e4dc] px-2 text-[#16161a] hover:bg-white"
                >
                  {isBn ? bn.ui.affirm : "affirm"} {item.subjects > 1 ? `×${item.subjects}` : ""}
                </button>
                <button type="button" className="h-6 rounded-sm border border-[#3a3a42] px-2 hover:border-[#8a8a94]">
                  {isBn ? bn.ui.defer : "defer"}
                </button>
                <span className="text-[#6f6f78]">{item.source}</span>
              </div>
            </li>
            );
          })}
        </ol>
      </aside>

      {/* Bottom dock — the bill, and what it does not claim. */}
      <section className="absolute right-3 bottom-3 left-3 z-10 max-h-52 overflow-auto rounded border border-[#2e2e34] bg-[#101013]/92 backdrop-blur">
        <>
            <div className="flex items-center justify-between border-b border-[#2e2e34] px-3 py-1.5 text-[0.6875rem] uppercase tracking-[0.12em] text-[#8a8a94]">
              <span>{isBn ? bn.bill : project.bill}</span>
              <span>
                {isBn ? bn.ui.scopeRegister : "scope register"} {absenceSummary.cellsWithLines}/
                {absenceSummary.cellsTotal} · {absenceSummary.cellsUnresolved}{" "}
                {isBn ? bn.ui.unresolved : "unresolved"}
              </span>
            </div>
            <table className="w-full border-collapse text-[0.75rem]">
              <tbody>
                {billLines.map((l) => (
                  <tr key={l.itemNo} className="border-b border-[#232329]">
                    <td className={`py-1 pr-3 pl-3 ${figures} text-[#8a8a94]`}>{l.itemNo}</td>
                    <td className="max-w-[28rem] truncate py-1 pr-3">
                      {isBn ? l.descriptionBn : l.description}
                    </td>
                    <td className={`py-1 pr-3 text-right ${figures}`}>
                      {l.quantity ? (
                        `${formatQuantity(l.quantity, precision[l.unit] ?? 2)} ${l.unit}`
                      ) : (
                        <span style={{ color: "var(--proto-refuse)" }}>
                          ⊘ {isBn ? bn.ui.noQuantity : "no quantity"}
                        </span>
                      )}
                    </td>
                    <td className={`py-1 pr-3 text-right ${figures}`}>
                      {l.amount ? (
                        formatTaka(l.amount)
                      ) : (
                        <span className="text-[#8a8a94]">{isBn ? bn.ui.unpriced : "unpriced"}</span>
                      )}
                    </td>
                    <td className="flex gap-2 py-1 pr-3">
                      <BasisMark basis={l.quantityBasis} />
                      <CoverageMark coverage={l.coverage} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="py-1.5 pr-3 text-right uppercase">
                    {isBn ? bn.subtotalLabel : "measured-scope subtotal"}
                  </td>
                  <td className={`py-1.5 pr-3 text-right text-base ${figures}`}>
                    {formatTaka(measuredScopeSubtotal)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[#2e2e34] px-3 py-2 text-[0.75rem]">
              {exclusions.map((e) => (
                <span key={`${e.elementClass}-${e.quantityKind}`} className="flex items-baseline gap-1">
                  <span className="text-[#8a8a94]">
                    {e.elementClass}×{e.quantityKind}
                  </span>
                  <CauseMark cause={e.cause} />
                </span>
              ))}
            </div>
            <p className="px-3 pb-2 text-[0.75rem]" style={{ color: "var(--proto-weak)" }}>
              {isBn ? bn.disclosure : interpretedDisclosure.statement}
            </p>
            {isBn && (
              <div className="border-t border-[#2e2e34]">
                <BanglaCertificate tone="viewport" />
              </div>
            )}
          </>
      </section>
    </div>
  );
}
