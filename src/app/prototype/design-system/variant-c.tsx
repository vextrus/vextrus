"use client";

/**
 * PROTOTYPE — ticket 10, variant C: "The Docket".
 *
 * The register: a case file. Cool neutral ground, one typeface, hierarchy
 * carried by size and rule-weight rather than by chrome. The structure rejects
 * the list entirely: **one judgement at a time**, full width, its evidence
 * framed above it as a hero band, driven from the keyboard (j / k / a / d).
 * What a list normally occupies is given instead to the thing a list can never
 * show — the absence ledger, sitting above everything, because the money is in
 * what has no row.
 *
 * The claim it makes: a queue feels mechanical when it is a wall of identical
 * confirm buttons. Make each act singular, batch what is bookkeeping, and show
 * the act log filling as you go — judgement then feels like judgement.
 *
 * This is the one variant with live state (SKILL.md rule 5): disposing an item
 * moves the docket and appends to the act log, all in memory.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { formatQuantity, formatTaka } from "@/core/format";
import { BanglaCertificate } from "./bangla-certificate";
import { CanvasMock } from "./canvas-mock";
import {
  absenceSummary,
  billLines,
  exclusions,
  interpretedDisclosure,
  measuredScopeSubtotal,
  project,
  queue,
} from "./fixtures";
import { BasisMark, CauseMark, CoverageMark, figures, queueKindLabel } from "./marks";

const tokens = {
  "--proto-strong": "#186a4b",
  "--proto-caution": "#7a5b12",
  "--proto-weak": "#9c4318",
  "--proto-refuse": "#8e2f2f",
} as CSSProperties;

const precision: Record<string, number> = { "m³": 3, "m²": 2, kg: 2 };

interface ActRow {
  type: string;
  subject: string;
  subjects: number;
  cause?: string;
}

export function VariantC({ lang }: { lang: "en" | "bn" }) {
  const [index, setIndex] = useState(0);
  const [acts, setActs] = useState<ActRow[]>([]);
  const item = queue[index];

  function dispose(kind: "affirm" | "defer") {
    if (!item) return;
    setActs((a) => [
      {
        type: kind === "affirm" ? `${queueKindLabel[item.kind].toUpperCase()}_CONFIRMED` : "DEFERRAL_FILED",
        subject: item.headline,
        subjects: item.subjects,
        ...(kind === "defer" ? { cause: "NOT_ESTABLISHED" } : {}),
      },
      ...a,
    ]);
    setIndex((i) => Math.min(i + 1, queue.length - 1));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "j") setIndex((i) => Math.min(i + 1, queue.length - 1));
      if (e.key === "k") setIndex((i) => Math.max(i - 1, 0));
      if (e.key === "a") dispose("affirm");
      if (e.key === "d") dispose("defer");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `dispose` closes over the current item; re-bind whenever it changes.
  }, [index]);

  if (lang === "bn") {
    return (
      <div className="min-h-screen bg-[#f4f4f2] text-[#1b1b1a]" style={tokens}>
        <BanglaCertificate />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f4f4f2] pb-24 text-[#1b1b1a]"
      style={{ ...tokens, fontFamily: 'ui-sans-serif, "Segoe UI", system-ui, sans-serif' }}
    >
      {/* Absence first. A list of rows can never show this, so it gets the top of the page. */}
      <header className="border-b-2 border-[#1b1b1a] bg-white px-8 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#6a6a66]">
              {project.name} · {project.drawingSet}
            </p>
            <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight">
              {absenceSummary.cellsUnresolved} of {absenceSummary.cellsTotal} class × kind cells have no
              line and no cause
            </h1>
            <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-[#4a4a46]">
              {absenceSummary.cellsWithLines} produced lines, {absenceSummary.cellsExcluded} are declared
              exclusions with a named cause. Everything else is silence — the only condemned state.
            </p>
          </div>
          <div className="text-right font-mono text-[0.75rem] text-[#6a6a66]">
            <div className="flex justify-end gap-0.5">
              {queue.map((q, i) => (
                <span
                  key={q.id}
                  aria-hidden
                  title={q.headline}
                  className="h-4 w-3"
                  style={{
                    background:
                      i === index ? "#1b1b1a" : i < index ? "#b9b9b3" : q.blocking ? "#8e2f2f" : "#dcdcd6",
                  }}
                />
              ))}
            </div>
            <p className="mt-1">
              docket {index + 1}/{queue.length} · j / k to move
            </p>
          </div>
        </div>
      </header>

      {item && (
        <article className="mx-auto max-w-[110rem] px-8 py-6">
          {/* Evidence above the judgement, full width — not a thumbnail beside a form. */}
          <div className="h-[52vh] min-h-[22rem] border border-[#c9c9c2] bg-white">
            <CanvasMock
              tone="paper"
              highlight={item.kind === "DISCREPANCY" ? ["C-7", "C-8", "C-11"] : []}
              raster={item.kind === "DISCIPLINE"}
              caption={`${item.source} — framed by the source keys this decision cites`}
            />
          </div>

          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#6a6a66]">
                {queueKindLabel[item.kind]}
                {item.blocking && (
                  <span style={{ color: "var(--proto-refuse)" }}> · ▮ blocks ingestion</span>
                )}
              </p>
              <h2 className="mt-1 text-xl leading-tight font-semibold">{item.headline}</h2>
              <p className="mt-2 max-w-[68ch] text-[0.9375rem] leading-relaxed text-[#3a3a36]">
                {item.detail}
              </p>
              <p className="mt-3 max-w-[68ch] border-l-2 border-[#1b1b1a] pl-3 font-mono text-[0.8125rem]">
                machine proposes — {item.proposal}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => dispose("affirm")}
                  className="h-9 rounded-sm bg-[#1b1b1a] px-4 text-[0.9375rem] text-white hover:bg-black"
                >
                  Affirm{item.subjects > 1 ? ` all ${item.subjects} subjects` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => dispose("defer")}
                  className="h-9 rounded-sm border border-[#1b1b1a] px-4 text-[0.9375rem] hover:bg-[#e8e8e2]"
                >
                  Defer with cause
                </button>
                <span className="font-mono text-[0.75rem] text-[#6a6a66]">
                  recorded as one act with {item.subjects} subject{item.subjects === 1 ? "" : "s"} —
                  the granularity performed
                </span>
              </div>
            </div>

            {/* The act log, filling as you work: the audit is visible, not implied. */}
            <aside className="border-l border-[#c9c9c2] pl-5">
              <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#6a6a66]">
                act log · append-only · {acts.length} this session
              </h3>
              {acts.length === 0 ? (
                <p className="mt-2 text-[0.8125rem] text-[#6a6a66]">
                  Nothing disposed yet. Attribution is derived from this log, never stamped on rows.
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {acts.map((a, i) => (
                    <li key={`${a.type}-${i}`} className="border-b border-[#e0e0da] pb-2">
                      <p className="font-mono text-[0.75rem]">
                        {a.type} <span className="text-[#6a6a66]">×{a.subjects}</span>
                      </p>
                      <p className="text-[0.8125rem] text-[#3a3a36]">{a.subject}</p>
                      {a.cause && (
                        <p className="font-mono text-[0.6875rem]" style={{ color: "var(--proto-refuse)" }}>
                          cause {a.cause} · {project.surveyor}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
        </article>
      )}

      {/* The document, one scroll below the work — the same page, not another app. */}
      <section className="mx-auto mt-6 max-w-[110rem] border-t-2 border-[#1b1b1a] bg-white px-8 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{project.bill}</h2>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#6a6a66]">
            measured-scope subtotal only
          </p>
        </div>
        <table className="mt-3 w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr className="border-b border-[#c9c9c2] text-left font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-[#6a6a66]">
              <th className="w-14 py-1 font-normal">item</th>
              <th className="py-1 font-normal">description</th>
              <th className="w-28 py-1 pr-3 text-right font-normal">quantity</th>
              <th className="w-12 py-1 pr-3 font-normal">unit</th>
              <th className="w-28 py-1 pr-3 text-right font-normal">rate</th>
              <th className="w-32 py-1 pr-3 text-right font-normal">amount</th>
              <th className="w-56 py-1 pl-3 font-normal">basis · coverage</th>
            </tr>
          </thead>
          <tbody>
            {billLines.map((l) => (
              <tr key={l.itemNo} className="border-b border-[#eaeae4] align-top">
                <td className={`py-2 ${figures}`}>{l.itemNo}</td>
                <td className="py-2 pr-6">
                  {l.description}
                  {l.omitted && (
                    <span className="block text-[0.75rem]" style={{ color: "var(--proto-weak)" }}>
                      omits: {l.omitted.join("; ")}
                    </span>
                  )}
                  <span className="block font-mono text-[0.6875rem] text-[#6a6a66]">
                    {l.source}
                    {l.rule ? ` · ${l.rule}` : ""}
                    {l.vectorizer ? ` · ${l.vectorizer}` : ""}
                  </span>
                </td>
                <td className={`py-2 text-right pr-3 ${figures}`}>
                  {l.quantity ? (
                    formatQuantity(l.quantity, precision[l.unit] ?? 2)
                  ) : (
                    <span style={{ color: "var(--proto-refuse)" }}>⊘ no quantity</span>
                  )}
                </td>
                <td className="py-2 pr-3">{l.unit}</td>
                <td className={`py-2 text-right pr-3 ${figures}`}>{l.rate ? formatTaka(l.rate) : ""}</td>
                <td className={`py-2 text-right pr-3 ${figures}`}>
                  {l.amount ? formatTaka(l.amount) : <span className="text-[#6a6a66]">unpriced</span>}
                </td>
                <td className="flex flex-wrap gap-x-3 py-2 pl-3">
                  <BasisMark basis={l.quantityBasis} label="quantity basis" />
                  <BasisMark basis={l.selectionBasis} label="selection basis" />
                  <CoverageMark coverage={l.coverage} />
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="py-3 pr-3 text-right font-semibold">
                Measured-scope subtotal
              </td>
              <td className={`py-3 text-right text-lg font-semibold ${figures}`}>
                {formatTaka(measuredScopeSubtotal)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>

        <h3 className="mt-6 border-t border-[#c9c9c2] pt-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#6a6a66]">
          certificate of measured coverage
        </h3>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {exclusions.map((e) => (
            <li key={`${e.elementClass}-${e.quantityKind}`} className="text-[0.8125rem]">
              <span className={`${figures} text-[0.75rem]`}>
                {e.elementClass} × {e.quantityKind}
              </span>{" "}
              <CauseMark cause={e.cause} />
              <span className="block text-[#4a4a46]">
                {e.note} — {e.actor ?? "machine"}, {e.at}
              </span>
            </li>
          ))}
        </ul>
        <p
          className="mt-3 max-w-[80ch] border-l-2 pl-3 text-[0.8125rem]"
          style={{ borderColor: "var(--proto-weak)" }}
        >
          {interpretedDisclosure.statement}
        </p>
        <p className="mt-3 text-[0.75rem] text-[#6a6a66]">
          Signed for the measured scope above: {project.surveyor}. No grand total prints under
          incomplete coverage.
        </p>
      </section>
    </div>
  );
}
