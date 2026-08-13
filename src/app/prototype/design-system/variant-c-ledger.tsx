"use client";

/**
 * PROTOTYPE — variant C · "Ledger". Document-first.
 *
 * The argument: the product is a document that gets signed and tendered, so
 * the screen should *be* the document — measured to a page, set in a text face,
 * with the certificate bound to the bill on the same scroll (they cannot be
 * emitted apart, §6). The drawing is evidence, pinned beside the line you are
 * reading; clicking a line moves the evidence, not the page.
 *
 * What it risks: disposition has nowhere to live except a badge on the row, and
 * §6 explicitly bans per-row marks on the bill's *face*. So this variant proves
 * something even if it loses — the marks below the rule line are the screen
 * view, and the print view (greyscale toggle) has to drop them.
 *
 * Register: warm white paper, black text face, no colour required to read it.
 */

import { useState } from "react";
import { DrawingCanvas, StatusLegend, planElements } from "./canvas";
import { absences, bills, certificate, lines, project, queue, t } from "./data";
import { density, type Density } from "./density";
import { count, qty, type Lang } from "./format";

const TOKENS = {
  "--vx-canvas": "#ffffff",
  "--vx-surface": "#ffffff",
  "--vx-surface-2": "#f2f0eb",
  "--vx-ink": "#15130f",
  "--vx-ink-2": "#4a463f",
  "--vx-ink-3": "#7d786e",
  "--vx-grid": "#b6b1a6",
  "--vx-line": "#d8d4cb",
  "--vx-accent": "#1d4ed8",
  "--vx-mono": "ui-monospace, 'SF Mono', 'JetBrains Mono', monospace",
  "--vx-text": "ui-serif, Georgia, 'Times New Roman', serif",
} as React.CSSProperties;

export const NAME = "Ledger — document-first";

export function VariantC({ lang, dens }: { lang: Lang; dens: Density }) {
  const d = density[dens];
  const [ref, setRef] = useState<string>(lines[0]?.ref ?? "");
  const line = lines.find((l) => l.ref === ref) ?? lines[0];
  const el = planElements.find((e) => e.ref === ref) ?? null;
  if (!line) return null; // fixture is non-empty; this is the compiler's toll

  return (
    <div
      style={TOKENS}
      className="flex h-screen w-full overflow-hidden bg-[var(--vx-surface-2)] text-[var(--vx-ink)]"
    >
      {/* the page */}
      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto my-8 w-[min(52rem,92%)] bg-[var(--vx-surface)] shadow-[0_1px_0_0_var(--vx-line),0_12px_28px_-18px_rgba(0,0,0,0.4)]">
          <div className="border-b border-[var(--vx-ink)] px-10 pt-10 pb-4">
            <div className="flex items-baseline gap-3">
              <h1 className="font-(family-name:--vx-text) text-[24px] leading-tight font-semibold">
                {lang === "bn" ? "পরিমাণের বিল" : "Quantity Bill"}
              </h1>
              <span className="font-(family-name:--vx-mono) text-[11px] tracking-wide text-[var(--vx-ink-2)] uppercase">
                {lang === "bn" ? "অমূল্যায়িত" : "unpriced"}
              </span>
            </div>
            <p className="mt-1 font-(family-name:--vx-text) text-[15px]">{t(project.name, lang)}</p>
            <p className="font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
              {t(project.set, lang)} · {project.revision} · {project.taxonomyVersion}
            </p>
            <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
              {bills.map((b) => (
                <span
                  key={b.id}
                  className={`font-(family-name:--vx-text) text-[13px] ${
                    b.id === "superstructure"
                      ? "border-b-2 border-[var(--vx-ink)] font-semibold"
                      : "text-[var(--vx-ink-3)]"
                  }`}
                >
                  {t(b.name, lang)}
                </span>
              ))}
            </nav>
          </div>

          <table className="w-full border-collapse font-(family-name:--vx-text)">
            <thead>
              <tr className="border-b border-[var(--vx-ink)] text-left">
                <th className={`${d.head} w-14 font-(family-name:--vx-mono) font-semibold`}>
                  {lang === "bn" ? "ক্রম" : "Item"}
                </th>
                <th className={`${d.head} font-(family-name:--vx-mono) font-semibold`}>
                  {lang === "bn" ? "বিবরণ" : "Description"}
                </th>
                <th className={`${d.head} w-16 font-(family-name:--vx-mono) font-semibold`}>
                  {lang === "bn" ? "একক" : "Unit"}
                </th>
                <th className={`${d.head} w-32 text-right font-(family-name:--vx-mono) font-semibold`}>
                  {lang === "bn" ? "পরিমাণ" : "Quantity"}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={l.ref}
                  onClick={() => setRef(l.ref)}
                  className={`cursor-pointer border-b border-[var(--vx-line)] align-baseline ${
                    l.ref === ref ? "bg-[var(--vx-surface-2)]" : ""
                  }`}
                >
                  <td className={`${d.row} font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]`}>
                    {l.itemNo}
                  </td>
                  <td className={`${d.row} ${d.rowText}`}>
                    {t(l.description, lang)}
                    {/* below the rule line, off the face: screen-only marks */}
                    <span className="mt-0.5 block font-(family-name:--vx-mono) text-[10px] text-[var(--vx-ink-3)]">
                      {l.ref} · {l.drawing}/{t(l.view, lang)} · {l.basis}
                      {l.coverage === "PARTIAL_DECLARED" &&
                        ` · ◐ ${lang === "bn" ? "আংশিক, ঘোষিত" : "partial, declared"}`}
                      {l.deferral && ` · ⊘ ${l.deferral.code}`}
                      {l.vectorizer && ` · ≈ ${l.vectorizer}`}
                    </span>
                  </td>
                  <td className={`${d.row} font-(family-name:--vx-mono) ${d.rowText}`}>
                    {l.quantity ? l.unit : ""}
                  </td>
                  <td
                    className={`${d.row} text-right font-(family-name:--vx-mono) ${d.rowText} tabular-nums whitespace-nowrap`}
                  >
                    {l.quantity ? (
                      qty(l.quantity, l.dp, lang)
                    ) : (
                      <span className="text-[11px] uppercase">
                        {lang === "bn" ? "পরিমাণ নেই" : "no quantity"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--vx-ink)]">
                <td />
                <td className={`${d.row} font-(family-name:--vx-text) text-[13px] font-semibold`}>
                  {lang === "bn"
                    ? "পরিমাপকৃত পরিধির উপ-মোট — কোনো সর্বমোট নয়, কারণ কভারেজ অসম্পূর্ণ"
                    : "Measured-scope subtotal — no grand total, coverage is incomplete"}
                </td>
                <td colSpan={2} className={`${d.row} text-right font-(family-name:--vx-mono) text-[11px]`}>
                  {lang === "bn" ? "মিশ্র একক" : "mixed units"}
                </td>
              </tr>
            </tbody>
          </table>

          {/* the certificate is bound to the bill — they cannot be emitted apart */}
          <section className="border-t-4 border-double border-[var(--vx-ink)] px-10 py-8">
            <h2 className="font-(family-name:--vx-text) text-[19px] font-semibold">
              {lang === "bn" ? "পরিমাপকৃত কভারেজের সনদ" : "Certificate of Measured Coverage"}
            </h2>
            <p className="mt-1 font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
              {project.taxonomyVersion} · {project.ruleSet}
            </p>

            <h3 className="mt-5 font-(family-name:--vx-text) text-[14px] font-semibold">
              {lang === "bn" ? "যা পরিমাপ করা হয়নি, এবং কেন" : "What was not measured, and why"}
            </h3>
            <ul className="mt-1.5">
              {absences.map((a) => (
                <li
                  key={`${a.elementClass}-${a.cause}`}
                  className="border-b border-[var(--vx-line)] py-1.5"
                >
                  <span className="font-(family-name:--vx-mono) text-[11.5px]">
                    {a.elementClass} × {t(a.kind, lang)} — {a.cause}
                  </span>
                  <p className="font-(family-name:--vx-text) text-[12.5px] leading-snug text-[var(--vx-ink-2)]">
                    {t(a.detail, lang)}
                  </p>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 font-(family-name:--vx-text) text-[14px] font-semibold">
              {lang === "bn" ? "যন্ত্র-ব্যাখ্যাত জ্যামিতি" : "Machine-interpreted geometry"}
            </h3>
            <p className="font-(family-name:--vx-text) text-[13px] leading-relaxed">
              {t(certificate.disclosure, lang)}{" "}
              <span className="font-(family-name:--vx-mono) text-[11px]">
                {certificate.vectorizer} · {count(certificate.dpi, lang)} DPI
              </span>
            </p>

            <div className="mt-6 flex items-start gap-3 border-2 border-[var(--vx-ink)] px-4 py-3">
              <span className="font-(family-name:--vx-mono) text-[15px] leading-none">⚠</span>
              <div>
                <p className="font-(family-name:--vx-mono) text-[12px] font-semibold uppercase">
                  {certificate.status} — {lang === "bn" ? "উৎপাদন প্রত্যাখ্যাত" : "generation refuses"}
                </p>
                <p className="font-(family-name:--vx-text) text-[12.5px] leading-snug">
                  {t(certificate.refusal, lang)}
                </p>
                <p className="mt-1 font-(family-name:--vx-mono) text-[11px] text-[var(--vx-ink-2)]">
                  {t(certificate.surveyor, lang)}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* evidence, pinned to the line you are reading */}
      <aside className="flex w-[26rem] shrink-0 flex-col border-l border-[var(--vx-line)] bg-[var(--vx-surface)]">
        <div className="border-b border-[var(--vx-line)] px-4 py-2">
          <h2 className="font-(family-name:--vx-mono) text-[11px] tracking-wide uppercase">
            {lang === "bn" ? "প্রমাণ" : "Evidence"} · {line.drawing} / {t(line.view, lang)}
          </h2>
        </div>
        <div className="aspect-[5/4] border-b border-[var(--vx-line)] bg-[var(--vx-surface-2)]">
          <DrawingCanvas
            lang={lang}
            selected={el?.id ?? null}
            onSelect={() => {}}
            chrome={false}
            className="h-full w-full"
          />
        </div>
        <div className={`${d.pane} flex flex-col ${d.gap} overflow-auto`}>
          <StatusLegend lang={lang} />
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 font-(family-name:--vx-mono) text-[11px]">
            {[
              ["register", line.ref],
              ["basis", line.basis],
              ["coverage", line.coverage],
              ["rule", line.ruleId ?? "—"],
              ["actor", line.actor ?? (lang === "bn" ? "কেউ নয়" : "none")],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--vx-ink-3)]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {line.partialNote && (
            <p className="border-l-4 border-[var(--vx-ink)] bg-[var(--vx-surface-2)] px-3 py-2 font-(family-name:--vx-text) text-[12.5px] leading-snug">
              <b className="font-(family-name:--vx-mono) text-[11px]">◐ PARTIAL_DECLARED</b>{" "}
              {t(line.partialNote, lang)}
            </p>
          )}
          {line.deferral && (
            <p className="border-l-4 border-[var(--vx-ink)] bg-[var(--vx-surface-2)] px-3 py-2 font-(family-name:--vx-text) text-[12.5px] leading-snug">
              <b className="font-(family-name:--vx-mono) text-[11px]">⊘ {line.deferral.code}</b>{" "}
              {t(line.deferral.note, lang)}
            </p>
          )}
          <div className="border-t border-[var(--vx-line)] pt-2">
            <h3 className="font-(family-name:--vx-mono) text-[10.5px] tracking-wide uppercase text-[var(--vx-ink-3)]">
              {lang === "bn" ? "এই নথি আটকে থাকা কাজ" : "Blocking this document"}
            </h3>
            <ul className="mt-1">
              {queue.map((q) => (
                <li key={q.id} className="py-0.5 font-(family-name:--vx-mono) text-[11px]">
                  {q.severed ? "✕" : "⊘"} {q.cause} · {q.drawing} · ×{count(q.subjects, lang)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
