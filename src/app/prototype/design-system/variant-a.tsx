/**
 * PROTOTYPE — ticket 10, variant A: "Drafting Table".
 *
 * The register: a document instrument on paper. Warm off-white, hairline
 * rules, a text face with a drawing-office feel, colour used sparingly and
 * never load-bearing. The structure: canvas and worklist are *persistent
 * partners* in a 58/42 split, with the bill and its certificate as a drawer
 * beneath both — the drawing is never a thumbnail, and a disposition is never
 * more than a glance from the evidence it cites.
 *
 * The claim it makes: a QS reads this for eight hours next to a printed sheet,
 * and it looks like the document they will sign.
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
  "--proto-strong": "#1f6f4f",
  "--proto-caution": "#7a5b12",
  "--proto-weak": "#a34a1f",
  "--proto-refuse": "#8a3b3b",
} as CSSProperties;

const precision: Record<string, number> = { "m³": 3, "m²": 2, kg: 2 };

export function VariantA({ lang }: { lang: "en" | "bn" }) {
  const isBn = lang === "bn";
  /* Bangla steps up one size and runs a looser leading; figures never step, so
     every `figures` cell keeps the Latin data size in both languages. */
  const script: CSSProperties = isBn
    ? { fontFamily: 'var(--font-bangla, "Noto Sans Bengali"), ui-sans-serif, sans-serif', lineHeight: 1.7 }
    : { fontFamily: 'ui-sans-serif, "Segoe UI", system-ui, sans-serif', lineHeight: 1.3 };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#faf9f6] text-[#1c1a17]"
      style={{ ...tokens, ...script }}
    >
      {/* Masthead — the title block of the sheet you are working on. */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ddd6ca] px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {isBn ? bn.project : project.name}
          </h1>
          <p className="text-[0.8125rem] text-[#6b6459]">
            {project.drawingSet} · {isBn ? bn.bill : project.bill}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[#8a3b3b]">
            <span aria-hidden>◧</span> coverage declared incomplete
          </p>
          <p className="text-[0.8125rem] text-[#6b6459]">{project.surveyor}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* The drawing — 58%, persistent, never collapsed to a thumbnail. */}
        <section className="flex min-h-[26rem] flex-col border-b border-[#ddd6ca] lg:w-[58%] lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#ddd6ca] px-4 py-1.5">
            <div className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
              {["calibrate", "trace", "count", "snap ½ grid"].map((t) => (
                <button key={t} type="button" className="hover:text-[#1c1a17]">
                  {t}
                </button>
              ))}
            </div>
            <p className="font-mono text-[0.6875rem] text-[#6b6459]">
              S-201 rev C · framed on C-7, C-8, C-11
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <CanvasMock
              tone="paper"
              highlight={["C-7", "C-8", "C-11"]}
              caption="highlight cites source keys — it never mutates the drawing"
            />
          </div>
        </section>

        {/* The worklist — 42%, blocking work ruled off above the rest. */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-baseline justify-between border-b border-[#ddd6ca] px-4 py-1.5">
            <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
              {isBn ? `${bn.ui.disposition} · ${queue.length} ${bn.ui.open}` : `disposition · ${queue.length} open`}
            </h2>
            <p className="font-mono text-[0.6875rem] text-[#8a3b3b]">
              {queue.filter((q) => q.blocking).length} {isBn ? bn.ui.blocking : "blocking"}
            </p>
          </div>
          <ol className="min-h-0 flex-1 overflow-auto">
            {queue.map((item) => {
              const t = queueText(item, lang);
              return (
              <li
                key={item.id}
                className="border-b border-[#e8e2d6] px-4 py-2 hover:bg-[#f4f1e8]"
                style={item.blocking ? { boxShadow: "inset 3px 0 0 #8a3b3b" } : undefined}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
                    {isBn ? bn.queueKindLabels[item.kind] : queueKindLabel[item.kind]}
                  </span>
                  <BlockingMark blocking={item.blocking} />
                </div>
                <p
                  className="font-medium"
                  style={{ fontSize: isBn ? "1rem" : "0.9375rem", lineHeight: isBn ? 1.7 : 1.2 }}
                >
                  {t.headline}
                </p>
                <p
                  className="mt-0.5 text-[#6b6459]"
                  style={{ fontSize: isBn ? "0.875rem" : "0.8125rem", lineHeight: isBn ? 1.7 : 1.35 }}
                >
                  {t.detail}
                </p>
                <p className="mt-1 border-l-2 border-[#ddd6ca] pl-2 text-[0.75rem] text-[#3f3a33]">
                  <span className="font-mono">{isBn ? bn.ui.machine : "machine"}:</span> {t.proposal}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="h-7 rounded-sm border border-[#1c1a17] px-2 text-[0.8125rem] hover:bg-[#1c1a17] hover:text-[#faf9f6]"
                  >
                    {isBn
                      ? item.subjects > 1
                        ? bn.ui.affirmAll(item.subjects)
                        : bn.ui.affirm
                      : `Affirm${item.subjects > 1 ? ` all ${item.subjects}` : ""}`}
                  </button>
                  <button
                    type="button"
                    className="h-7 rounded-sm border border-[#b6ab98] px-2 text-[0.8125rem] hover:border-[#1c1a17]"
                  >
                    {isBn ? bn.ui.defer : "Defer with cause"}
                  </button>
                  <span className="text-[0.6875rem] text-[#6b6459]">
                    {isBn
                      ? bn.ui.act(item.subjects)
                      : `one act · ${item.subjects} subject${item.subjects === 1 ? "" : "s"}`}{" "}
                    <span className="font-mono">· {item.source}</span>
                  </span>
                </div>
              </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* The document drawer: the bill's face, then what it does not claim.
          In bn the *table* is Bangla too — swapping only the certificate left
          the dense surface, where the type scale is actually under load,
          untested. */}
      <>
        <section className="border-t-2 border-[#1c1a17] bg-[#fffefb] px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{isBn ? bn.bill : project.bill}</h2>
            <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
              {isBn
                ? bn.ui.subtotalOnly
                : "measured-scope subtotal only · no grand total under incomplete coverage"}
            </p>
          </div>

          <table className="mt-2 w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b border-[#ddd6ca] text-left font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
                <th className="w-14 py-1 font-normal">{isBn ? bn.ui.item : "item"}</th>
                <th className="py-1 font-normal">{isBn ? bn.ui.description : "description"}</th>
                <th className="w-12 py-1 pr-3 font-normal">{isBn ? bn.ui.unit : "unit"}</th>
                <th className="w-28 py-1 pr-3 text-right font-normal">
                  {isBn ? bn.ui.quantity : "quantity"}
                </th>
                <th className="w-28 py-1 pr-3 text-right font-normal">{isBn ? bn.ui.rate : "rate"}</th>
                <th className="w-32 py-1 pr-3 text-right font-normal">
                  {isBn ? bn.ui.amount : "amount"}
                </th>
                <th className="w-64 py-1 pl-3 font-normal">
                  {isBn ? bn.ui.basisCoverage : "basis · coverage"}
                </th>
              </tr>
            </thead>
            <tbody>
              {billLines.map((l) => (
                <tr key={l.itemNo} className="border-b border-[#efe9dd] align-top">
                  <td className={`py-1.5 ${figures}`}>{l.itemNo}</td>
                  <td className="py-1.5 pr-4" style={{ lineHeight: isBn ? 1.7 : 1.35 }}>
                    {isBn ? l.descriptionBn : l.description}
                    {l.omitted && (
                      <span className="block text-[0.75rem] text-[#a34a1f]">
                        {isBn ? bn.ui.omits : "omits"}: {l.omitted.join("; ")}
                      </span>
                    )}
                    <span className="block font-mono text-[0.6875rem] text-[#6b6459]">
                      {l.source}
                      {l.rule ? ` · ${l.rule}` : ""}
                      {l.vectorizer ? ` · ${l.vectorizer}` : ""}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">{l.unit}</td>
                  <td className={`py-1.5 text-right pr-3 ${figures}`}>
                    {l.quantity ? (
                      formatQuantity(l.quantity, precision[l.unit] ?? 2)
                    ) : (
                      <span className="text-[#8a3b3b]">
                        <span aria-hidden>⊘</span> {isBn ? bn.ui.noQuantity : "no quantity"}
                      </span>
                    )}
                  </td>
                  <td className={`py-1.5 text-right pr-3 ${figures}`}>{l.rate ? formatTaka(l.rate) : ""}</td>
                  <td className={`py-1.5 text-right pr-3 ${figures}`}>
                    {l.amount ? (
                      formatTaka(l.amount)
                    ) : (
                      <span className="text-[0.6875rem] text-[#6b6459]">
                        {isBn ? bn.ui.unpriced : "unpriced"}
                      </span>
                    )}
                  </td>
                  <td className="flex flex-wrap gap-x-3 py-1.5 pl-3">
                    <BasisMark basis={l.quantityBasis} label="quantity basis" />
                    <BasisMark basis={l.selectionBasis} label="selection basis" />
                    <CoverageMark coverage={l.coverage} />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="py-2 pr-3 text-right font-semibold">
                  {isBn ? bn.subtotalLabel : "Measured-scope subtotal"}
                </td>
                <td className={`py-2 text-right text-base font-semibold ${figures}`}>
                  {formatTaka(measuredScopeSubtotal)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>

          <div className="mt-4 grid gap-4 border-t border-[#ddd6ca] pt-3 md:grid-cols-2">
            <div>
              <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
                {isBn
                  ? `${bn.certificate} · ${bn.ui.declaredExclusions}`
                  : "certificate of measured coverage · declared exclusions"}
              </h3>
              <ul className="mt-1 space-y-1 text-[0.8125rem]">
                {exclusions.map((e) => (
                  <li key={`${e.elementClass}-${e.quantityKind}`}>
                    <span className={`${figures} text-[0.75rem]`}>
                      {e.elementClass} × {e.quantityKind}
                    </span>{" "}
                    <CauseMark cause={e.cause} />
                    <span className="block pl-4 text-[#6b6459]">
                      {e.note}
                      {e.actor ? ` — ${e.actor}, ${e.at}` : ` — machine, ${e.at}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-[#6b6459]">
                {isBn
                  ? `${bn.ui.scopeRegister} · ${absenceSummary.cellsTotal} class × kind`
                  : `scope register · ${absenceSummary.cellsTotal} class × kind cells`}
              </h3>
              <p className="mt-1 text-[0.8125rem]">
                {absenceSummary.cellsWithLines}{" "}
                {isBn ? bn.ui.producedLines : "produced lines"} · {absenceSummary.cellsExcluded}{" "}
                {isBn ? bn.ui.declaredExclusions : "declared exclusions"} ·{" "}
                <strong>
                  {absenceSummary.cellsUnresolved} {isBn ? bn.ui.unresolved : "unresolved"}
                </strong>
              </p>
              <p className="mt-2 border-l-2 border-[#a34a1f] pl-3 text-[0.8125rem]">
                {isBn ? bn.disclosure : interpretedDisclosure.statement}
              </p>
              <p className="mt-2 text-[0.75rem] text-[#6b6459]">
                {isBn ? bn.ui.signedFor : "Signed for the measured scope above"}: {project.surveyor}
              </p>
            </div>
          </div>
        </section>

        {/* The signed document itself, in Bangla, under the Bangla bill. */}
        {isBn && (
          <section className="border-t border-[#ddd6ca] bg-[#fffefb]">
            <BanglaCertificate />
          </section>
        )}
      </>
    </div>
  );
}
