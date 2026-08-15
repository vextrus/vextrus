/**
 * PROTOTYPE — ticket 10, shell "docket".
 *
 * The claim: a disposition is a judgement, and a judgement is made one at a
 * time with the evidence in front of you. So the page is a case file — the
 * absence ledger as its headline (the money is in what has no row), the drawing
 * full-width as the exhibit, one subject under it, and an append-only act log
 * that shows what you have already signed for.
 *
 * The queue does not disappear: it runs as a strip so the shape of the work is
 * still legible. That is the fix for the obvious objection to a one-at-a-time
 * surface — you cannot plan a day inside it.
 *
 * What it costs: the bill is a scroll away, and a QS who wants to sweep 94
 * transcription subjects is being handed them one at a time unless the strip
 * lets them jump.
 */

import { CanvasMock } from "./canvas-mock";
import {
  AbsenceLedger,
  ActLog,
  BillTable,
  Certificate,
  Label,
  QueueDocket,
  ScopePanel,
  SectionHead,
} from "./parts";
import { bn, project, queue, queueText } from "./fixtures";
import { queueKindLabel } from "./marks";
import { statusVars, type Theme } from "./theme";

export function ShellDocket({
  t,
  selectedId,
  onSelect,
}: {
  t: Theme;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const isBn = t.lang === "bn";
  const current = queue.find((q) => q.id === selectedId) ?? queue[0];
  if (!current) return null;
  const index = queue.findIndex((q) => q.id === current.id);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: t.p.ground, color: t.p.ink, ...statusVars(t.p) }}
    >
      {/* Absence is the headline, above the project's own name. */}
      <header
        className="border-b px-6"
        style={{ borderColor: t.p.ink, background: t.p.raised, paddingTop: 14, paddingBottom: 14 }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <AbsenceLedger t={t} headline />
          <div className="text-right">
            <p className="font-semibold" style={{ fontSize: isBn ? "1rem" : "0.9375rem" }}>
              {isBn ? bn.project : project.name}
            </p>
            <Label t={t}>{project.drawingSet}</Label>
            <br />
            <Label t={t} tone={t.p.refuse}>
              <span aria-hidden>◧</span> coverage declared incomplete
            </Label>
          </div>
        </div>
      </header>

      {/* The queue as a strip: the shape of the work, without leaving the docket. */}
      <nav
        className="flex gap-0 overflow-x-auto border-b"
        style={{ borderColor: t.p.rule, background: t.p.sunken }}
      >
        {queue.map((item, i) => {
          const active = item.id === current.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="shrink-0 border-r px-3 text-left"
              style={{
                borderColor: t.p.rule,
                background: active ? t.p.raised : "transparent",
                paddingTop: t.s.padY,
                paddingBottom: t.s.padY,
                minWidth: "11rem",
                boxShadow: item.blocking ? `inset 0 -3px 0 ${t.p.refuse}` : undefined,
                opacity: i < index ? 0.55 : 1,
              }}
            >
              <Label t={t} tone={active ? t.p.ink : undefined}>
                {isBn ? bn.queueKindLabels[item.kind] : queueKindLabel[item.kind]}
              </Label>
              <span
                className="block truncate"
                style={{ fontSize: t.s.data, lineHeight: isBn ? 1.6 : 1.3 }}
              >
                {queueText(item, t.lang).headline}
              </span>
            </button>
          );
        })}
      </nav>

      {/* The exhibit — full width, above the judgement it belongs to. */}
      <section className="h-[42vh] min-h-[20rem] border-b" style={{ borderColor: t.p.rule }}>
        <CanvasMock
          tone={t.p.canvasTone}
          highlight={["C-7", "C-8", "C-11"]}
          raster={current.source.includes("S-118") || current.source.includes("S-119")}
          caption={`${current.source} — the evidence this judgement cites`}
        />
      </section>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex-1 border-b lg:border-r lg:border-b-0" style={{ borderColor: t.p.rule }}>
          <SectionHead
            t={t}
            right={
              <Label t={t}>
                {index + 1} / {queue.length} · j / k to move · a affirm · d defer
              </Label>
            }
          >
            {isBn ? bn.ui.disposition : "the judgement in front of you"}
          </SectionHead>
          <QueueDocket t={t} item={current} />
        </div>
        <aside className="lg:w-[26rem]" style={{ background: t.p.sunken }}>
          <SectionHead t={t}>act log · append-only, never edited</SectionHead>
          <ActLog t={t} />
        </aside>
      </div>

      {/* The document, under the whole case file. */}
      <section
        className="border-t-2 px-6"
        style={{ borderColor: t.p.ink, background: t.p.raised, paddingTop: 16, paddingBottom: 16 }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold" style={{ fontSize: "1rem" }}>
            {isBn ? bn.bill : project.bill}
          </h2>
          <Label t={t}>
            {isBn
              ? bn.ui.subtotalOnly
              : "measured-scope subtotal only · no grand total under incomplete coverage"}
          </Label>
        </div>
        <div className="mt-2">
          <BillTable t={t} />
        </div>
        <div className="mt-4 border-t pt-3" style={{ borderColor: t.p.rule }}>
          <ScopePanel t={t} />
        </div>
      </section>

      <section className="border-t" style={{ borderColor: t.p.rule }}>
        <Certificate t={t} />
      </section>
    </div>
  );
}
