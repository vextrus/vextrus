"use client";

/**
 * PROTOTYPE — variant A · "Drafting table". Canvas-first.
 *
 * The argument: the drawing is the workspace and everything else is an
 * instrument laid on top of it. The plan is full-bleed; disposition is a rail
 * that overlays the sheet's edge and can be pushed away; the bill is a drawer.
 * Register: warm paper ground, ink-on-vellum, one ochre accent, no chrome
 * gradients — it should read like a drawing under a lamp next to a printed one.
 *
 * What it risks: the queue is off to the side, so a QS who lives in the queue
 * pays a click for every disposition. That is the trade this variant is for.
 */

import { useState } from "react";
import { DrawingCanvas, StatusLegend, planElements } from "./canvas";
import { certificate, counters, lines, project, queue, t } from "./data";
import { density, type Density } from "./density";
import { compactScreenOnly, count, qty, type Lang } from "./format";

const TOKENS = {
  "--vx-canvas": "#f4efe4",
  "--vx-surface": "#fbf8f1",
  "--vx-surface-2": "#efe8d9",
  "--vx-ink": "#211d18",
  "--vx-ink-2": "#5c5346",
  "--vx-ink-3": "#8d8272",
  "--vx-grid": "#b9ac93",
  "--vx-line": "#ddd2ba",
  "--vx-accent": "#9a5b1e",
  "--vx-mono": "ui-monospace, 'SF Mono', 'JetBrains Mono', monospace",
} as React.CSSProperties;

export const NAME = "Drafting table — canvas-first";

export function VariantA({ lang, dens }: { lang: Lang; dens: Density }) {
  const d = density[dens];
  const [selected, setSelected] = useState<string | null>("B2");
  const [railOpen, setRailOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const el = planElements.find((e) => e.id === selected) ?? null;
  const line = el ? (lines.find((l) => l.ref === el.ref) ?? null) : null;

  return (
    <div
      style={TOKENS}
      className="relative flex h-screen w-full flex-col overflow-hidden bg-[var(--vx-canvas)] text-[var(--vx-ink)]"
    >
      {/* the only permanent chrome: a title-block strip, drawing-office idiom */}
      <header className="flex shrink-0 items-baseline gap-6 border-b border-[var(--vx-line)] bg-[var(--vx-surface)] px-5 py-2">
        <span className="font-(family-name:--vx-mono) text-[13px] font-semibold tracking-tight">
          {t(project.name, lang)}
        </span>
        <span className="text-[12px] text-[var(--vx-ink-2)]">
          {t(project.set, lang)} · {project.revision}
        </span>
        <span className="ml-auto flex items-center gap-4 text-[11px] text-[var(--vx-ink-2)]">
          {/* compact L/Cr is lawful here — screen chrome, never a document */}
          <span title="screen chrome only">
            {compactScreenOnly(counters.entities, lang)}{" "}
            {lang === "bn" ? "এনটিটি" : "entities"}
          </span>
          <span>
            {count(counters.registered, lang)} {lang === "bn" ? "নথিভুক্ত" : "registered"}
          </span>
          <span className="border border-[var(--vx-ink)] px-1.5 py-px font-(family-name:--vx-mono) uppercase">
            ⚠ {certificate.status}
          </span>
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* the sheet: full bleed, no frame, no padding — it is the room */}
        <div className="relative min-w-0 flex-1">
          <DrawingCanvas
            lang={lang}
            selected={selected}
            onSelect={setSelected}
            className="h-full w-full"
          />

          {/* the inspector rides the drawing rather than a side panel */}
          {el && (
            <div className="absolute bottom-6 left-6 w-[min(30rem,45vw)] border border-[var(--vx-ink)] bg-[var(--vx-surface)]/95 shadow-[6px_6px_0_0_var(--vx-surface-2)] backdrop-blur-[1px]">
              <div className="flex items-baseline gap-3 border-b border-[var(--vx-line)] px-4 py-2">
                <span className="font-(family-name:--vx-mono) text-[15px] font-semibold">
                  {el.mark} · {el.id}
                </span>
                <span className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
                  {el.ref}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="ml-auto text-[12px] text-[var(--vx-ink-3)] hover:text-[var(--vx-ink)]"
                >
                  ✕
                </button>
              </div>
              <div className={`${d.pane} flex flex-col ${d.gap}`}>
                {line ? (
                  <>
                    <p className={`${d.rowText} text-[var(--vx-ink-2)]`}>{t(line.description, lang)}</p>
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-(family-name:--vx-mono) text-[12px]">
                      <span>
                        {line.quantity ? (
                          <b className="text-[17px]">{qty(line.quantity, line.dp, lang)}</b>
                        ) : (
                          <b className="text-[13px] uppercase">
                            {lang === "bn" ? "পরিমাণ নেই" : "no quantity"}
                          </b>
                        )}{" "}
                        {line.quantity && line.unit}
                      </span>
                      <span className="text-[var(--vx-ink-2)]">
                        {line.basis} · {line.coverage}
                      </span>
                      <span className="text-[var(--vx-ink-2)]">
                        {line.drawing} / {t(line.view, lang)}
                      </span>
                      {line.ruleId && <span className="text-[var(--vx-ink-3)]">{line.ruleId}</span>}
                      {line.vectorizer && (
                        <span className="text-[var(--vx-ink-3)]">{line.vectorizer}</span>
                      )}
                    </div>
                    {line.deferral && (
                      <p className="border-l-4 border-[var(--vx-ink)] bg-[var(--vx-surface-2)] px-3 py-2 text-[12px]">
                        <b className="font-(family-name:--vx-mono)">⊘ {line.deferral.code}</b> —{" "}
                        {t(line.deferral.note, lang)}
                      </p>
                    )}
                    {line.partialNote && (
                      <p className="border-l-4 border-[var(--vx-ink)] bg-[var(--vx-surface-2)] px-3 py-2 text-[12px]">
                        <b className="font-(family-name:--vx-mono)">◐ PARTIAL_DECLARED</b> —{" "}
                        {t(line.partialNote, lang)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className={`${d.rowText}`}>
                    {lang === "bn" ? "এই সাইটিং বিল থেকে বিচ্ছিন্ন।" : "This sighting is severed from bill reach."}
                  </p>
                )}
                <StatusLegend lang={lang} className="pt-1" />
              </div>
            </div>
          )}

          {!railOpen && (
            <button
              onClick={() => setRailOpen(true)}
              className="absolute top-4 right-4 border border-[var(--vx-ink)] bg-[var(--vx-surface)] px-3 py-1.5 font-(family-name:--vx-mono) text-[12px]"
            >
              {lang === "bn" ? "নিষ্পত্তি" : "Disposition"} ({count(counters.queued, lang)}) ›
            </button>
          )}
        </div>

        {/* the rail: an instrument on the table, dismissable */}
        {railOpen && (
          <aside className="flex w-[22rem] shrink-0 flex-col border-l border-[var(--vx-line)] bg-[var(--vx-surface)]">
            <div className="flex items-baseline gap-2 border-b border-[var(--vx-line)] px-4 py-2">
              <h2 className="text-[13px] font-semibold">
                {lang === "bn" ? "নিষ্পত্তি সারি" : "Disposition queue"}
              </h2>
              <span className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
                {count(counters.queued, lang)} {lang === "bn" ? "বিষয়" : "subjects"}
              </span>
              <button
                onClick={() => setRailOpen(false)}
                className="ml-auto text-[12px] text-[var(--vx-ink-3)] hover:text-[var(--vx-ink)]"
              >
                ›
              </button>
            </div>
            <div className={`flex min-h-0 flex-1 flex-col overflow-auto ${d.gap} p-2`}>
              {queue.map((q) => (
                <article
                  key={q.id}
                  className={`${d.card} border border-[var(--vx-line)] bg-[var(--vx-canvas)]`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-3)]">
                      {q.id}
                    </span>
                    <span className={`${d.rowText} font-medium`}>{t(q.title, lang)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 font-(family-name:--vx-mono) text-[10.5px] text-[var(--vx-ink-2)]">
                    <span className="border border-[var(--vx-ink-3)] px-1">
                      {q.severed ? "✕ " : "⊘ "}
                      {q.cause}
                    </span>
                    <span>{q.drawing}</span>
                    <span>
                      {count(q.subjects, lang)} {lang === "bn" ? "টি" : "subj"}
                    </span>
                  </div>
                  {dens !== "dense" && (
                    <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--vx-ink-2)]">
                      {t(q.detail, lang)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* the bill lives in a drawer: present, not competing with the sheet */}
      <div className="shrink-0 border-t border-[var(--vx-line)] bg-[var(--vx-surface)]">
        <button
          onClick={() => setDrawer((v) => !v)}
          className="flex w-full items-baseline gap-4 px-5 py-1.5 text-left"
        >
          <span className="text-[12px] font-semibold">
            {drawer ? "▾" : "▴"} {lang === "bn" ? "পরিমাণ বিল (অমূল্যায়িত)" : "Quantity bill (unpriced)"}
          </span>
          <span className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
            {lang === "bn" ? "পরিমাপকৃত পরিধি উপ-মোট" : "measured-scope subtotal"} ·{" "}
            {lang === "bn" ? "কোনো সর্বমোট নয়" : "no grand total"}
          </span>
          <span className="ml-auto font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
            {t(certificate.disclosure, lang)}
          </span>
        </button>
        {drawer && (
          <div className="max-h-[38vh] overflow-auto border-t border-[var(--vx-line)]">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((l) => (
                  <tr key={l.ref} className="border-b border-[var(--vx-line)] align-baseline">
                    <td className={`${d.row} font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-3)]`}>
                      {l.itemNo}
                    </td>
                    <td className={`${d.row} ${d.rowText} max-w-0 w-full`}>
                      {t(l.description, lang)}
                      {l.partialNote && (
                        <span className="ml-2 font-(family-name:--vx-mono) text-[10.5px]">
                          ◐ {lang === "bn" ? "আংশিক, ঘোষিত" : "partial, declared"}
                        </span>
                      )}
                      {l.deferral && (
                        <span className="ml-2 font-(family-name:--vx-mono) text-[10.5px]">
                          ⊘ {l.deferral.code}
                        </span>
                      )}
                    </td>
                    <td className={`${d.row} text-right font-(family-name:--vx-mono) ${d.rowText} whitespace-nowrap`}>
                      {l.quantity ? qty(l.quantity, l.dp, lang) : "—"}
                    </td>
                    <td className={`${d.row} font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]`}>
                      {l.quantity ? l.unit : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
