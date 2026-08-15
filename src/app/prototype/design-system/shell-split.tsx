/**
 * PROTOTYPE — ticket 10, shell "split".
 *
 * The claim: a drawing and a worklist are *persistent partners*. Neither is
 * ever dismissed to get at the other, because a disposition is a judgement
 * about the drawing and reading it with the evidence off-screen is the thing a
 * QS refuses to do on paper. The document is a drawer beneath both — always
 * one scroll away, never competing for the same pixels.
 *
 * What it costs: 42% of the screen is permanently spent on a list, and the
 * drawing never gets the full width a busy foundation plan wants.
 */

import { CanvasMock } from "./canvas-mock";
import { BillTable, Certificate, Label, Masthead, QueueList, ScopePanel, SectionHead } from "./parts";
import { bn, project } from "./fixtures";
import { statusVars, type Theme } from "./theme";

export function ShellSplit({
  t,
  selectedId,
  onSelect,
}: {
  t: Theme;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const isBn = t.lang === "bn";
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: t.p.ground, color: t.p.ink, ...statusVars(t.p) }}
    >
      <Masthead t={t} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* The drawing — 58%, persistent, never a thumbnail. */}
        <section
          className="flex min-h-[26rem] flex-col border-b lg:w-[58%] lg:border-r lg:border-b-0"
          style={{ borderColor: t.p.rule }}
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4"
            style={{ borderColor: t.p.rule, paddingTop: t.s.padY, paddingBottom: t.s.padY }}
          >
            <div className="flex items-center gap-3">
              {["calibrate", "trace", "count", "snap ½ grid"].map((tool) => (
                <button key={tool} type="button">
                  <Label t={t}>{tool}</Label>
                </button>
              ))}
            </div>
            <Label t={t}>S-201 rev C · framed on C-7, C-8, C-11</Label>
          </div>
          <div className="min-h-0 flex-1">
            <CanvasMock
              tone={t.p.canvasTone}
              highlight={["C-7", "C-8", "C-11"]}
              caption="highlight cites source keys — it never mutates the drawing"
            />
          </div>
        </section>

        {/* The worklist — 42%, persistent. */}
        <section className="flex min-h-0 flex-1 flex-col">
          <QueueList t={t} selectedId={selectedId} onSelect={onSelect} />
        </section>
      </div>

      {/* The document drawer. */}
      <section
        className="border-t-2 px-6"
        style={{
          borderColor: t.p.ink,
          background: t.p.raised,
          paddingTop: 16,
          paddingBottom: 16,
        }}
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
        <SectionHead t={t}>the signed document</SectionHead>
        <Certificate t={t} />
      </section>
    </div>
  );
}
