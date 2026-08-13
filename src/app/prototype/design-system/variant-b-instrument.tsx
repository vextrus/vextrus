"use client";

/**
 * PROTOTYPE — variant B · "Instrument". Disposition-first, three panes.
 *
 * The argument: the QS's day is a worklist, so the worklist is the spine —
 * queue left, the sheet centre (large, not a thumbnail), the register row and
 * its provenance right. Keyboard-first: J/K walk the queue, the drawing
 * follows, one key files the act.
 *
 * Legacy's disposition surface "felt mechanical" — the thing this variant is
 * trying to kill. Its answer: every item leads with a sentence saying what the
 * machine could not establish and what happens if you do nothing, the subject
 * count is on the act (bulk corroboration is one act with N subjects, lawful
 * per §4), and the drawing is never smaller than the list.
 *
 * Register: cool graphite and steel, high contrast, tight monospace figures.
 */

import { useState } from "react";
import { DrawingCanvas, StatusLegend, planElements } from "./canvas";
import { absences, certificate, counters, lines, project, queue, t } from "./data";
import { density, type Density } from "./density";
import { count, qty, type Lang } from "./format";

const TOKENS = {
  "--vx-canvas": "#14171a",
  "--vx-surface": "#1b1f23",
  "--vx-surface-2": "#23282e",
  "--vx-ink": "#e8ecef",
  "--vx-ink-2": "#9aa5ae",
  "--vx-ink-3": "#6b757e",
  "--vx-grid": "#39424a",
  "--vx-line": "#2c333a",
  "--vx-accent": "#4cc2d4",
  "--vx-mono": "ui-monospace, 'SF Mono', 'JetBrains Mono', monospace",
} as React.CSSProperties;

export const NAME = "Instrument — disposition-first";

export function VariantB({ lang, dens }: { lang: Lang; dens: Density }) {
  const d = density[dens];
  const [active, setActive] = useState(queue[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>("B2");
  const item = queue.find((q) => q.id === active) ?? queue[0];
  const el = planElements.find((e) => e.id === selected) ?? null;
  const line = el ? (lines.find((l) => l.ref === el.ref) ?? null) : null;
  if (!item) return null; // fixture is non-empty; this is the compiler's toll

  return (
    <div
      style={TOKENS}
      className="flex h-screen w-full flex-col overflow-hidden bg-[var(--vx-canvas)] text-[var(--vx-ink)]"
    >
      <header className="flex shrink-0 items-center gap-5 border-b border-[var(--vx-line)] bg-[var(--vx-surface)] px-4 py-2">
        <span className="text-[13px] font-semibold">{t(project.name, lang)}</span>
        <span className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
          {t(project.set, lang)} · {project.revision} · {project.ruleSet}
        </span>
        <span className="ml-auto flex items-center gap-2 border border-[var(--vx-ink-2)] px-2 py-0.5 font-(family-name:--vx-mono) text-[11px] uppercase">
          ⚠ {certificate.status}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[22rem_1fr_23rem]">
        {/* pane 1 — the worklist */}
        <section className="flex min-h-0 flex-col border-r border-[var(--vx-line)] bg-[var(--vx-surface)]">
          <div className="flex items-baseline gap-2 border-b border-[var(--vx-line)] px-3 py-2">
            <h2 className="text-[12px] font-semibold tracking-wide uppercase">
              {lang === "bn" ? "নিষ্পত্তি" : "Disposition"}
            </h2>
            <span className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
              {count(queue.length, lang)} {lang === "bn" ? "কাজ" : "items"} ·{" "}
              {count(counters.queued, lang)} {lang === "bn" ? "বিষয়" : "subjects"}
            </span>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto">
            {queue.map((q) => {
              const on = q.id === active;
              return (
                <li key={q.id}>
                  <button
                    onClick={() => setActive(q.id)}
                    className={`w-full border-b border-[var(--vx-line)] text-left ${d.row} ${
                      on ? "bg-[var(--vx-surface-2)] shadow-[inset_3px_0_0_0_var(--vx-accent)]" : ""
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-(family-name:--vx-mono) text-[10.5px] text-[var(--vx-ink-3)]">
                        {q.id}
                      </span>
                      <span className={`${d.rowText} font-medium`}>{t(q.title, lang)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-(family-name:--vx-mono) text-[10px] text-[var(--vx-ink-2)]">
                      <span className="border border-[var(--vx-ink-3)] px-1">
                        {q.severed ? "✕" : "⊘"} {q.cause}
                      </span>
                      <span>{q.drawing}</span>
                      <span>×{count(q.subjects, lang)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* absence is where the money is — it sits under the queue, not in a report */}
          <div className="shrink-0 border-t border-[var(--vx-line)]">
            <h3 className={`${d.head} font-semibold tracking-wide uppercase text-[var(--vx-ink-2)]`}>
              {lang === "bn" ? "পরিধি নিবন্ধন — অনুপস্থিতি" : "Scope register — absence"}
            </h3>
            <ul className="max-h-44 overflow-auto">
              {absences.map((a) => (
                <li
                  key={`${a.elementClass}-${a.cause}`}
                  className={`${d.row} border-t border-[var(--vx-line)]`}
                >
                  <div className="flex items-baseline gap-2 font-(family-name:--vx-mono) text-[11px]">
                    <span>
                      {a.elementClass} × {t(a.kind, lang)}
                    </span>
                    <span className="ml-auto text-[10px] text-[var(--vx-ink-2)]">{a.cause}</span>
                  </div>
                  {dens === "relaxed" && (
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--vx-ink-2)]">
                      {t(a.detail, lang)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* pane 2 — the sheet, never a thumbnail */}
        <section className="flex min-h-0 flex-col bg-[var(--vx-canvas)]">
          <div className="flex shrink-0 items-center gap-3 border-b border-[var(--vx-line)] px-3 py-1.5">
            {["S-103", "S-104", "S-105", "S-106", "S-107", "S-108"].map((s) => (
              <span
                key={s}
                className={`font-(family-name:--vx-mono) text-[11px] ${
                  s === item.drawing
                    ? "border-b-2 border-[var(--vx-accent)] pb-0.5 text-[var(--vx-ink)]"
                    : "text-[var(--vx-ink-3)]"
                }`}
              >
                {s}
              </span>
            ))}
            <StatusLegend lang={lang} className="ml-auto" />
          </div>
          <div className="min-h-0 flex-1">
            <DrawingCanvas
              lang={lang}
              selected={selected}
              onSelect={setSelected}
              className="h-full w-full"
            />
          </div>
          {/* the act bar: what the machine could not establish, in a sentence */}
          <div className={`shrink-0 border-t border-[var(--vx-line)] bg-[var(--vx-surface)] ${d.pane}`}>
            <p className={`${d.rowText} max-w-[62ch] text-[var(--vx-ink-2)]`}>
              <b className="text-[var(--vx-ink)]">{t(item.title, lang)}</b> — {t(item.detail, lang)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className="border border-[var(--vx-ink)] bg-[var(--vx-ink)] px-3 py-1 text-[12px] font-medium text-[var(--vx-canvas)]">
                {item.severed
                  ? lang === "bn"
                    ? "বিচ্ছেদ বহাল রাখুন"
                    : "Uphold severance"
                  : lang === "bn"
                    ? `${count(item.subjects, lang)}টি বিষয়ে কাজ করুন`
                    : `Act on ${count(item.subjects, lang)} subjects`}{" "}
                <kbd className="ml-1 font-(family-name:--vx-mono) text-[10px] opacity-70">↵</kbd>
              </button>
              <button className="border border-[var(--vx-ink-3)] px-3 py-1 text-[12px]">
                {lang === "bn" ? "কারণসহ স্থগিত করুন" : "Defer with a reason"}{" "}
                <kbd className="ml-1 font-(family-name:--vx-mono) text-[10px] opacity-70">D</kbd>
              </button>
              <span className="font-(family-name:--vx-mono) text-[10.5px] text-[var(--vx-ink-3)]">
                {lang === "bn"
                  ? "একটি কাজ, একাধিক বিষয় — যে দানায় সম্পাদিত সেই দানায় নথিভুক্ত"
                  : "one act, N subjects — recorded at the granularity performed"}
              </span>
            </div>
          </div>
        </section>

        {/* pane 3 — the register row behind the selection */}
        <aside className="flex min-h-0 flex-col overflow-auto border-l border-[var(--vx-line)] bg-[var(--vx-surface)]">
          <div className="border-b border-[var(--vx-line)] px-3 py-2">
            <h2 className="text-[12px] font-semibold tracking-wide uppercase">
              {lang === "bn" ? "নিবন্ধন সারি" : "Register row"}
            </h2>
          </div>
          {el && (
            <div className={`${d.pane} flex flex-col ${d.gap}`}>
              <div className="font-(family-name:--vx-mono) text-[13px]">
                {el.mark} · {el.id} · <span className="text-[var(--vx-ink-2)]">{el.ref}</span>
              </div>
              {line ? (
                <>
                  <div className="font-(family-name:--vx-mono) text-[26px] leading-none tabular-nums">
                    {line.quantity ? (
                      <>
                        {qty(line.quantity, line.dp, lang)}{" "}
                        <span className="text-[14px] text-[var(--vx-ink-2)]">{line.unit}</span>
                      </>
                    ) : (
                      <span className="text-[15px] uppercase">
                        ⊘ {lang === "bn" ? "পরিমাণ নেই" : "no quantity"}
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 font-(family-name:--vx-mono) text-[11px]">
                    {[
                      ["quantityBasis", line.basis],
                      ["coverage", line.coverage],
                      ["drawing/view", `${line.drawing} / ${t(line.view, lang)}`],
                      ["rule", line.ruleId ?? "—"],
                      ["vectorizer", line.vectorizer ?? "—"],
                      ["actor", line.actor ?? (lang === "bn" ? "কেউ নয় — যন্ত্রের কাজ" : "none — machine work")],
                    ].map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-[var(--vx-ink-3)]">{k}</dt>
                        <dd className="text-[var(--vx-ink)]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className={`${d.rowText} text-[var(--vx-ink-2)]`}>{t(line.description, lang)}</p>
                  {line.deferral && (
                    <p className="border border-[var(--vx-ink-2)] px-2 py-1.5 text-[11.5px] leading-snug">
                      <b className="font-(family-name:--vx-mono)">⊘ {line.deferral.code}</b> —{" "}
                      {t(line.deferral.note, lang)}
                    </p>
                  )}
                  {line.partialNote && (
                    <p className="border border-[var(--vx-ink-2)] px-2 py-1.5 text-[11.5px] leading-snug">
                      <b className="font-(family-name:--vx-mono)">◐ PARTIAL_DECLARED</b> —{" "}
                      {t(line.partialNote, lang)}
                    </p>
                  )}
                </>
              ) : (
                <p className={`${d.rowText}`}>
                  ✕{" "}
                  {lang === "bn"
                    ? "বিচ্ছিন্ন — কোনো বিল থেকে যোগসূত্র নেই।"
                    : "Severed — no join from any bill."}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>

      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--vx-line)] bg-[var(--vx-surface)] px-3 py-1 font-(family-name:--vx-mono) text-[10.5px] text-[var(--vx-ink-3)]">
        <span>J/K {lang === "bn" ? "সারি" : "queue"}</span>
        <span>↵ {lang === "bn" ? "কাজ করুন" : "act"}</span>
        <span>D {lang === "bn" ? "স্থগিত" : "defer"}</span>
        <span>/ {lang === "bn" ? "খুঁজুন" : "search"}</span>
        <span className="ml-auto">{t(certificate.disclosure, lang)}</span>
      </footer>
    </div>
  );
}
