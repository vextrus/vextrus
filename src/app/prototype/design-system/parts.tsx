/**
 * PROTOTYPE — ticket 10. The surfaces a QS's day is made of, written once and
 * themed, so the three shells differ in *structure* and nothing else.
 *
 * This is deliberate, and it is the opposite of the skill's usual advice
 * against sharing between variants: the first build let each variant redraw
 * every surface, so a reviewer comparing two shells was also comparing two bill
 * tables, two queue rows and two typographic accidents. Shared parts mean the
 * only thing on trial in a shell switch is the arrangement. The *axes* — tone
 * and density — stay free, because they are what the parts read from the theme.
 *
 * A shell may still throw a part out or reshape it; none of them are a Layout.
 */

import type { CSSProperties, ReactNode } from "react";
import { formatQuantity, formatTaka } from "./format";
import {
  absenceSummary,
  actLog,
  billLines,
  bn,
  exclusions,
  interpretedDisclosure,
  measuredScopeSubtotal,
  project,
  queue,
  queueText,
  type QueueItem,
} from "./fixtures";
import { BasisMark, BlockingMark, CauseMark, CoverageMark, figures, queueKindLabel } from "./marks";
import { proseSize, type Theme } from "./theme";

const precision: Record<string, number> = { "m³": 3, "m²": 2, kg: 2 };

/* ---------------------------------------------------------------- chrome -- */

export function Label({ t, children, tone }: { t: Theme; children: ReactNode; tone?: string }) {
  return (
    <span
      className="font-mono uppercase tracking-[0.08em]"
      style={{ fontSize: t.s.label, color: tone ?? t.p.inkMuted }}
    >
      {children}
    </span>
  );
}

export function SectionHead({
  t,
  children,
  right,
}: {
  t: Theme;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline justify-between gap-3 border-b px-4"
      style={{ borderColor: t.p.rule, paddingTop: t.s.padY + 2, paddingBottom: t.s.padY + 2 }}
    >
      <Label t={t}>{children}</Label>
      {right}
    </div>
  );
}

/** The title block of the sheet you are working on — every shell carries one. */
export function Masthead({ t }: { t: Theme }) {
  const isBn = t.lang === "bn";
  return (
    <header
      className="flex flex-wrap items-end justify-between gap-3 border-b px-6"
      style={{ borderColor: t.p.rule, paddingTop: t.s.padY + 6, paddingBottom: t.s.padY + 6 }}
    >
      <div>
        <h1
          className="font-semibold tracking-tight"
          style={{ fontSize: isBn ? "1.1875rem" : "1.125rem" }}
        >
          {isBn ? bn.project : project.name}
        </h1>
        <p style={{ fontSize: proseSize(t.s, t.lang, "data"), color: t.p.inkMuted }}>
          {project.drawingSet} · {isBn ? bn.bill : project.bill}
        </p>
      </div>
      <div className="text-right">
        <Label t={t} tone={t.p.refuse}>
          <span aria-hidden>◧</span> coverage declared incomplete
        </Label>
        <p style={{ fontSize: t.s.data, color: t.p.inkMuted }}>{project.surveyor}</p>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------- queue -- */

/**
 * A worklist row at list density. The citation line is what forces `rowLoose`:
 * source key plus rule/vectorizer is a second line on most rows, and a scale
 * ruled on the headline alone is wrong on every row that carries one.
 */
export function QueueRow({
  t,
  item,
  selected,
  onSelect,
}: {
  t: Theme;
  item: QueueItem;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const text = queueText(item, t.lang);
  const isBn = t.lang === "bn";
  return (
    <li
      onClick={onSelect}
      className="cursor-pointer border-b px-4"
      style={{
        borderColor: t.p.ruleFaint,
        paddingTop: t.s.padY,
        paddingBottom: t.s.padY,
        background: selected ? t.p.wash : undefined,
        boxShadow: item.blocking ? `inset 3px 0 0 ${t.p.refuse}` : undefined,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Label t={t}>{isBn ? bn.queueKindLabels[item.kind] : queueKindLabel[item.kind]}</Label>
        <BlockingMark blocking={item.blocking} />
      </div>
      <p
        className="font-medium"
        style={{ fontSize: proseSize(t.s, t.lang, "body"), lineHeight: isBn ? 1.7 : 1.25 }}
      >
        {text.headline}
      </p>
      <p
        style={{
          fontSize: proseSize(t.s, t.lang, "data"),
          color: t.p.inkMuted,
          lineHeight: isBn ? 1.7 : 1.35,
        }}
      >
        {text.detail}
      </p>
      <p
        className="mt-1 border-l-2 pl-2"
        style={{
          borderColor: t.p.rule,
          fontSize: proseSize(t.s, t.lang, "data"),
          lineHeight: isBn ? 1.7 : 1.35,
        }}
      >
        <span className="font-mono">{isBn ? bn.ui.machine : "machine"}:</span> {text.proposal}
      </p>
      <QueueActions t={t} item={item} />
    </li>
  );
}

export function QueueActions({ t, item }: { t: Theme; item: QueueItem }) {
  const isBn = t.lang === "bn";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-sm border px-2"
        style={{
          height: t.s.row,
          borderColor: t.p.ink,
          color: t.p.ink,
          fontSize: proseSize(t.s, t.lang, "data"),
        }}
      >
        {isBn
          ? item.subjects > 1
            ? bn.ui.affirmAll(item.subjects)
            : bn.ui.affirm
          : `Affirm${item.subjects > 1 ? ` all ${item.subjects}` : ""}`}
      </button>
      <button
        type="button"
        className="rounded-sm border px-2"
        style={{
          height: t.s.row,
          borderColor: t.p.rule,
          color: t.p.inkMuted,
          fontSize: proseSize(t.s, t.lang, "data"),
        }}
      >
        {isBn ? bn.ui.defer : "Defer with cause"}
      </button>
      <span style={{ fontSize: t.s.label, color: t.p.inkMuted }}>
        {isBn
          ? bn.ui.act(item.subjects)
          : `one act · ${item.subjects} subject${item.subjects === 1 ? "" : "s"}`}{" "}
        <span className="font-mono">· {item.source}</span>
      </span>
    </div>
  );
}

export function QueueList({
  t,
  selectedId,
  onSelect,
}: {
  t: Theme;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const isBn = t.lang === "bn";
  return (
    <>
      <SectionHead
        t={t}
        right={
          <Label t={t} tone={t.p.refuse}>
            {queue.filter((q) => q.blocking).length} {isBn ? bn.ui.blocking : "blocking"}
          </Label>
        }
      >
        {isBn
          ? `${bn.ui.disposition} · ${queue.length} ${bn.ui.open}`
          : `disposition · ${queue.length} open`}
      </SectionHead>
      <ol className="min-h-0 flex-1 overflow-auto">
        {queue.map((item) => (
          <QueueRow
            key={item.id}
            t={t}
            item={item}
            selected={item.id === selectedId}
            onSelect={onSelect ? () => onSelect(item.id) : undefined}
          />
        ))}
      </ol>
    </>
  );
}

/** The same subject at judgement density — one at a time, nothing else competing. */
export function QueueDocket({ t, item }: { t: Theme; item: QueueItem }) {
  const text = queueText(item, t.lang);
  const isBn = t.lang === "bn";
  return (
    <div className="px-6" style={{ paddingTop: t.s.padY + 8, paddingBottom: t.s.padY + 8 }}>
      <div className="flex flex-wrap items-baseline gap-3">
        <Label t={t}>{isBn ? bn.queueKindLabels[item.kind] : queueKindLabel[item.kind]}</Label>
        <BlockingMark blocking={item.blocking} />
        <Label t={t}>{item.source}</Label>
      </div>
      <h2
        className="mt-1 font-semibold"
        style={{ fontSize: isBn ? "1.375rem" : "1.3125rem", lineHeight: isBn ? 1.55 : 1.2 }}
      >
        {text.headline}
      </h2>
      <p
        className="mt-1 max-w-[72ch]"
        style={{ fontSize: proseSize(t.s, t.lang, "body"), lineHeight: isBn ? 1.7 : 1.45 }}
      >
        {text.detail}
      </p>
      <p
        className="mt-3 max-w-[72ch] border-l-2 pl-3"
        style={{
          borderColor: t.p.weak,
          fontSize: proseSize(t.s, t.lang, "body"),
          lineHeight: isBn ? 1.7 : 1.45,
        }}
      >
        <span className="font-mono" style={{ fontSize: t.s.label }}>
          {isBn ? bn.ui.machine : "machine proposes"}
        </span>
        <br />
        {text.proposal}
      </p>
      <QueueActions t={t} item={item} />
    </div>
  );
}

/* ------------------------------------------------------------------ bill -- */

export function BillTable({ t }: { t: Theme }) {
  const isBn = t.lang === "bn";
  const head = (label: string, extra?: string) => (
    <th
      className={`font-normal ${extra ?? ""}`}
      style={{ paddingTop: t.s.padY, paddingBottom: t.s.padY }}
    >
      {label}
    </th>
  );
  return (
    <table className="w-full border-collapse" style={{ fontSize: t.s.data }}>
      <thead>
        <tr
          className="border-b text-left font-mono uppercase tracking-[0.08em]"
          style={{ borderColor: t.p.rule, color: t.p.inkMuted, fontSize: t.s.label }}
        >
          {head(isBn ? bn.ui.item : "item", "w-14")}
          {head(isBn ? bn.ui.description : "description")}
          {head(isBn ? bn.ui.unit : "unit", "w-12 pr-3")}
          {head(isBn ? bn.ui.quantity : "quantity", "w-28 pr-3 text-right")}
          {head(isBn ? bn.ui.rate : "rate", "w-28 pr-3 text-right")}
          {head(isBn ? bn.ui.amount : "amount", "w-32 pr-3 text-right")}
          {head(isBn ? bn.ui.basisCoverage : "basis · coverage", "w-64 pl-3")}
        </tr>
      </thead>
      <tbody>
        {billLines.map((l) => {
          /* A row with a second citation line is the `rowLoose` case; a row with
             enumerated omissions is a third. Both are on this table on purpose. */
          const cellStyle: CSSProperties = {
            paddingTop: t.s.padY,
            paddingBottom: t.s.padY,
            minHeight: l.omitted ? t.s.rowLoose : t.s.row,
          };
          return (
            <tr key={l.itemNo} className="border-b align-top" style={{ borderColor: t.p.ruleFaint }}>
              <td className={figures} style={cellStyle}>
                {l.itemNo}
              </td>
              <td className="pr-4" style={{ ...cellStyle, lineHeight: isBn ? 1.7 : 1.35 }}>
                {isBn ? l.descriptionBn : l.description}
                {l.omitted && (
                  <span className="block" style={{ fontSize: t.s.label, color: t.p.weak }}>
                    {isBn ? bn.ui.omits : "omits"}: {l.omitted.join("; ")}
                  </span>
                )}
                <span
                  className="block font-mono"
                  style={{ fontSize: t.s.label, color: t.p.inkMuted }}
                >
                  {l.source}
                  {l.rule ? ` · ${l.rule}` : ""}
                  {l.vectorizer ? ` · ${l.vectorizer}` : ""}
                </span>
              </td>
              <td className="pr-3" style={cellStyle}>
                {l.unit}
              </td>
              <td className={`text-right pr-3 ${figures}`} style={cellStyle}>
                {l.quantity ? (
                  formatQuantity(l.quantity, precision[l.unit] ?? 2)
                ) : (
                  <span style={{ color: t.p.refuse }}>
                    <span aria-hidden>⊘</span> {isBn ? bn.ui.noQuantity : "no quantity"}
                  </span>
                )}
              </td>
              <td className={`text-right pr-3 ${figures}`} style={cellStyle}>
                {l.rate ? formatTaka(l.rate) : ""}
              </td>
              <td className={`text-right pr-3 ${figures}`} style={cellStyle}>
                {l.amount ? (
                  formatTaka(l.amount)
                ) : (
                  <span style={{ fontSize: t.s.label, color: t.p.inkMuted }}>
                    {isBn ? bn.ui.unpriced : "unpriced"}
                  </span>
                )}
              </td>
              <td className="flex flex-wrap gap-x-3 pl-3" style={cellStyle}>
                <BasisMark basis={l.quantityBasis} label="quantity basis" />
                <BasisMark basis={l.selectionBasis} label="selection basis" />
                <CoverageMark coverage={l.coverage} />
              </td>
            </tr>
          );
        })}
        <tr>
          <td colSpan={5} className="pr-3 text-right font-semibold" style={{ paddingTop: 10, paddingBottom: 10 }}>
            {isBn ? bn.subtotalLabel : "Measured-scope subtotal"}
          </td>
          <td
            className={`text-right font-semibold ${figures}`}
            style={{ paddingTop: 10, paddingBottom: 10, fontSize: "1rem" }}
          >
            {formatTaka(measuredScopeSubtotal)}
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

/* ----------------------------------------------------------------- scope -- */

/** What the bill does not claim. Every shell shows this; they disagree on where. */
export function ScopePanel({ t, columns = 2 }: { t: Theme; columns?: 1 | 2 }) {
  const isBn = t.lang === "bn";
  return (
    <div className={`grid gap-4 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      <div>
        <Label t={t}>
          {isBn
            ? `${bn.certificate} · ${bn.ui.declaredExclusions}`
            : "certificate of measured coverage · declared exclusions"}
        </Label>
        <ul className="mt-1 space-y-1" style={{ fontSize: proseSize(t.s, t.lang, "data") }}>
          {exclusions.map((e) => (
            <li key={`${e.elementClass}-${e.quantityKind}`}>
              <span className={figures} style={{ fontSize: t.s.label }} lang="en">
                {e.elementClass} × {e.quantityKind}
              </span>{" "}
              <CauseMark cause={e.cause} />
              {/* The bn cause *label* renders beside the enum, never instead of
                  it — whether that is right is ticket point 6's second half. */}
              {isBn && <span style={{ color: t.p.inkMuted }}> — {bn.causeLabels[e.cause]}</span>}
              <span className="block pl-4" style={{ color: t.p.inkMuted, lineHeight: isBn ? 1.7 : 1.4 }}>
                {e.note}
                {e.actor ? ` — ${e.actor}, ${e.at}` : ` — machine, ${e.at}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <AbsenceLedger t={t} />
        <p
          className="mt-2 border-l-2 pl-3"
          style={{
            borderColor: t.p.weak,
            fontSize: proseSize(t.s, t.lang, "data"),
            lineHeight: isBn ? 1.7 : 1.45,
          }}
        >
          {isBn ? bn.disclosure : interpretedDisclosure.statement}
        </p>
        <p className="mt-2" style={{ fontSize: t.s.label, color: t.p.inkMuted }}>
          {isBn ? bn.ui.signedFor : "Signed for the measured scope above"}: {project.surveyor}
        </p>
      </div>
    </div>
  );
}

/** The absence ledger. In the docket shell this is the page's headline. */
export function AbsenceLedger({ t, headline = false }: { t: Theme; headline?: boolean }) {
  const isBn = t.lang === "bn";
  const cell = (n: number, label: string, tone?: string) => (
    <div>
      <div
        className={figures}
        style={{ fontSize: headline ? "1.75rem" : "1.125rem", color: tone ?? t.p.ink, lineHeight: 1.1 }}
      >
        {n}
      </div>
      <Label t={t} tone={tone}>
        {label}
      </Label>
    </div>
  );
  return (
    <div>
      <Label t={t}>
        {isBn
          ? `${bn.ui.scopeRegister} · ${absenceSummary.cellsTotal} class × kind`
          : `scope register · ${absenceSummary.cellsTotal} class × kind cells`}
      </Label>
      <div className={`mt-1 flex flex-wrap ${headline ? "gap-8" : "gap-5"}`}>
        {cell(absenceSummary.cellsWithLines, isBn ? bn.ui.producedLines : "produced lines")}
        {cell(absenceSummary.cellsExcluded, isBn ? bn.ui.declaredExclusions : "declared exclusions")}
        {cell(absenceSummary.cellsUnresolved, isBn ? bn.ui.unresolved : "unresolved", t.p.refuse)}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- act log -- */

export function ActLog({ t }: { t: Theme }) {
  const isBn = t.lang === "bn";
  return (
    <ul style={{ fontSize: proseSize(t.s, t.lang, "data") }}>
      {actLog.map((a) => (
        <li
          key={a.at}
          className="border-b px-4"
          style={{
            borderColor: t.p.ruleFaint,
            paddingTop: t.s.padY,
            paddingBottom: t.s.padY,
            lineHeight: isBn ? 1.7 : 1.4,
          }}
        >
          <span className="font-mono" style={{ fontSize: t.s.label, color: t.p.inkMuted }}>
            {a.at} · {a.actor} · {a.subjects} subj
          </span>
          <span className="block">{isBn ? a.actBn : a.act}</span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------- certificate -- */

/**
 * The signed document, in both languages — the first build only ever rendered
 * it in Bangla, so the English certificate was never on trial at all.
 *
 * **Numerals are deliberately inconsistent across this prototype and that is
 * the exhibit**: prose counts in Bangla digits while every quantity, rate and
 * amount stays Western. Ticket point 6 rules it; a prototype may not.
 */
export function Certificate({ t }: { t: Theme }) {
  const isBn = t.lang === "bn";
  return (
    <section
      lang={t.lang}
      className="mx-auto max-w-[78rem] px-8"
      style={{
        paddingTop: 24,
        paddingBottom: 24,
        lineHeight: isBn ? 1.7 : 1.5,
        fontSize: isBn ? "1rem" : "0.9375rem",
        background: t.p.raised,
        color: t.p.ink,
      }}
    >
      <header className="mb-3 border-b pb-2" style={{ borderColor: t.p.rule }}>
        <h2 className="text-xl font-semibold">
          {isBn ? bn.certificate : "Certificate of Measured Coverage"}
        </h2>
        <p style={{ opacity: 0.7, fontSize: isBn ? "0.9375rem" : "0.875rem" }}>
          {isBn ? `${bn.project} · ${bn.bill}` : `${project.name} · ${project.bill}`}
        </p>
      </header>

      <p className="max-w-[70ch]">
        {isBn
          ? bn.scopeStatement
          : "This certificate does not claim complete scope. The parts listed below were not measured, and each is declared with a named cause."}
      </p>

      <h3 className="mt-5 mb-1 font-semibold">
        {isBn ? bn.excludedHeading : "Declared exclusions"}
      </h3>
      <ul className="space-y-1.5">
        {exclusions.map((e) => (
          <li
            key={`${e.elementClass}-${e.quantityKind}`}
            className="flex flex-wrap items-baseline gap-x-2"
            style={{ fontSize: isBn ? "0.9375rem" : "0.875rem" }}
          >
            <span aria-hidden style={{ opacity: 0.6 }}>
              ⊘
            </span>
            <span className="font-mono" style={{ fontSize: t.s.label }} lang="en">
              {e.elementClass} × {e.quantityKind}
            </span>
            <span style={{ opacity: 0.85 }}>— {isBn ? bn.causeLabels[e.cause] : e.cause}</span>
            {e.actor && (
              <span style={{ opacity: 0.6 }} lang="en">
                · {e.actor}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-5 max-w-[70ch] border-l-2 pl-3" style={{ borderColor: t.p.weak }}>
        {isBn ? bn.disclosure : interpretedDisclosure.statement}
      </p>

      <div
        className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t pt-3"
        style={{ borderColor: t.p.rule }}
      >
        <span>{isBn ? bn.subtotalLabel : "Measured-scope subtotal"}</span>
        <span className={`text-lg ${figures}`} lang="en">
          {formatTaka(measuredScopeSubtotal)}
        </span>
      </div>
      <p className="mt-1" style={{ fontSize: t.s.data, opacity: 0.7 }}>
        {isBn ? bn.noGrandTotal : "No grand total prints under incomplete coverage."}
      </p>
      <p className="mt-8">
        {isBn ? bn.signature : "Signature · responsible surveyor"}:{" "}
        <span lang="en">{project.surveyor}</span>
      </p>
    </section>
  );
}
