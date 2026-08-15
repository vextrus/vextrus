/**
 * PROTOTYPE — ticket 10, shell "stage".
 *
 * The claim: the drawing *is* the page. Everything else is a dock at its edge,
 * and the viewport takes whatever is left — which on a large office monitor is
 * most of it.
 *
 * **The docks push; they do not float.** The first build had them overlay the
 * canvas, which meant the shell could only ever be rejected for occluding the
 * drawing it claims to be about — a layout defect standing in for the axis
 * under test. Now opening the document re-fits the canvas instead of covering
 * it, so what is on trial is "canvas as page" and nothing else.
 *
 * What it costs: the worklist is a 24rem column with no room for a second line
 * of reasoning, and the bill is never visible at the same time as the drawing.
 */

import { CanvasMock } from "./canvas-mock";
import {
  ActLog,
  BillTable,
  Certificate,
  Label,
  QueueList,
  ScopePanel,
  SectionHead,
} from "./parts";
import { bn, project } from "./fixtures";
import { statusVars, type Theme } from "./theme";

export function ShellStage({
  t,
  selectedId,
  onSelect,
  docOpen,
  onToggleDoc,
}: {
  t: Theme;
  selectedId: string;
  onSelect: (id: string) => void;
  docOpen: boolean;
  onToggleDoc: () => void;
}) {
  const isBn = t.lang === "bn";
  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: t.p.ground, color: t.p.ink, ...statusVars(t.p) }}
    >
      {/* A single chrome strip — on this shell the masthead is a rail, not a header. */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4"
        style={{ borderColor: t.p.rule, paddingTop: t.s.padY, paddingBottom: t.s.padY }}
      >
        <div className="flex items-baseline gap-3">
          <span className="font-semibold" style={{ fontSize: proseHeader(t.lang) }}>
            {isBn ? bn.project : project.name}
          </span>
          <Label t={t}>{project.drawingSet}</Label>
          <Label t={t} tone={t.p.refuse}>
            <span aria-hidden>◧</span> coverage declared incomplete
          </Label>
        </div>
        <div className="flex items-center gap-3">
          {["calibrate", "trace", "count", "snap ½ grid"].map((tool) => (
            <button key={tool} type="button">
              <Label t={t}>{tool}</Label>
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleDoc}
            className="rounded-sm border px-2"
            style={{ height: t.s.row, borderColor: t.p.ink, fontSize: t.s.label }}
          >
            {docOpen ? "hide document" : "show document"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* The stage. Shrinks when the dock opens — it is never covered. */}
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CanvasMock
              tone={t.p.canvasTone}
              highlight={["C-7", "C-8", "C-11"]}
              caption="S-201 rev C · framed on C-7, C-8, C-11 — highlight never mutates the drawing"
            />
          </div>

          {docOpen && (
            <section
              className="min-h-0 shrink-0 overflow-auto border-t-2"
              style={{ borderColor: t.p.ink, background: t.p.raised, height: "45vh" }}
            >
              <div className="px-6" style={{ paddingTop: 12, paddingBottom: 16 }}>
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
              </div>
              <div className="border-t" style={{ borderColor: t.p.rule }}>
                <Certificate t={t} />
              </div>
            </section>
          )}
        </main>

        {/* The dock: worklist above, act log below. */}
        <aside
          className="flex w-[24rem] shrink-0 flex-col border-l"
          style={{ borderColor: t.p.rule, background: t.p.sunken }}
        >
          <div className="flex min-h-0 flex-[3] flex-col">
            <QueueList t={t} selectedId={selectedId} onSelect={onSelect} />
          </div>
          <div className="flex min-h-0 flex-[2] flex-col border-t" style={{ borderColor: t.p.rule }}>
            <SectionHead t={t}>act log · append-only</SectionHead>
            <div className="min-h-0 flex-1 overflow-auto">
              <ActLog t={t} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function proseHeader(lang: "en" | "bn") {
  return lang === "bn" ? "1rem" : "0.9375rem";
}
