# PROTOTYPE — the design system

> Three variants of the takeoff working surface, switchable via `?variant=`, on the throwaway
> route `/prototype/design-system`. Sub-shape B: there is no existing page to host them, which is
> the fact that made [ticket 10](../../../../.wayfinder/takeoff/tickets/10-the-design-system.md)
> exist.

**Throwaway. None of this is production code.** No tests, no error handling, no abstractions, no
database, no auth. When a direction wins, it gets rewritten properly; the losers go to the
throwaway branch, not into `src/`.

## Run it

```
pnpm dev          # or pnpm dev:bg
open http://localhost:3210/prototype/design-system
```

The floating bar at the bottom carries four axes. `←`/`→` also cycle the variant.

| axis | values | the question it answers |
|---|---|---|
| variant | `A` `B` `C` | which direction |
| density | `relaxed` `default` `dense` | ticket §2 — where the middle sits |
| lang | `EN` `বাংলা` | ticket §6 — what Bangla does to the type scale |
| colour/grey | toggle | ticket §4 — `quantity-contract.md` §6: nothing may ride on colour alone |

Everything is in the URL: `?variant=B&lang=bn&density=dense` is shareable and reload-stable.

## The three directions

Each variant disagrees about **what the screen is for**, not about colour.

- **A · Drafting table — canvas-first.** The drawing is the room; the plan is full-bleed with no
  frame, disposition is a rail you can push away, the bill is a drawer, and the inspector rides
  on top of the sheet rather than beside it. Warm paper ground, ink-on-vellum.
  *Risk it takes:* a QS who lives in the queue pays a click per disposition.
- **B · Instrument — disposition-first.** The day is a worklist, so the worklist is the spine:
  queue left, sheet centre (large — never a thumbnail), register row and provenance right,
  scope-register **absence** pinned under the queue rather than buried in a report. Keyboard
  hints on the footer. Cool graphite, high contrast.
  *Risk it takes:* three panes is the layout that "felt mechanical" in legacy — its answer is
  that every item leads with a sentence naming what the machine could not establish, and the act
  bar states the subject count on the act (`one act, N subjects`).
- **C · Ledger — document-first.** The product is a document that gets signed and tendered, so
  the screen *is* the document: page measure, text face, bill and certificate on one scroll
  (they cannot be emitted apart, §6). The drawing is evidence pinned beside the line you are
  reading. Warm white paper, black text face.
  *Risk it takes:* disposition has nowhere to live but a mark on the row, and §6 bans per-row
  marks on the bill's **face** — so its marks sit below the rule line, in the screen view only.

## Real content only, on purpose

Every row is domain content from `docs/domain/`, not filler — a design system proven on lorem
ipsum proves nothing:

- a **partial-coverage** line (3.03: laps not scheduled on S-107, declared, with a named actor
  because judgement entered — `quantity-contract.md` §3);
- a **row with no quantity** (3.04: `SCALE_UNAFFIRMED`; *no line is the most expensive defect*,
  §6);
- an **`INTERPRETED`** line off a raster sheet, corroborated, carrying vectorizer + DPI and
  deliberately **no** per-line actor (§3);
- a **severed** sighting (`DISCIPLINE_NOT_AUTHORITATIVE`) that appears in the queue and in the
  drawing and **never** in the bill — over-measurement is a hard block, never a disclosure;
- the **scope register's absence census** by (class × kind) with the
  `INGESTION_TRUNCATED` / `ENTITY_TYPE_UNHANDLED` split (§2);
- a certificate that refuses on **unsigned**, prints **no percentage and no line count**, and
  carries the raster disclosure **by sheet**;
- a **measured-scope subtotal** and no grand total.

Numbers group lakh/crore (`1,24,560.40`), hand-rolled — `toLocaleString` is banned. Compact
`L`/`Cr` appears in **exactly one place**, variant A's screen chrome (`12.40 L entities`), and
never on the bill or the certificate. That contrast is deliberate.

## What the prototype already settles (evidence, not taste)

These fell out of building it and are not really open:

1. **Status must be shape + glyph + text.** The greyscale toggle is the check. Fill/hatch/dashed
   outline/✕ and a `⊘ CAUSE` code survive it in all three variants; the moment a status was a
   tint, it vanished. `canvas.tsx`'s legend is the pattern to keep.
2. **`default` is the density.** `density.ts` carries the computed row box for each step —
   relaxed 48 px, default 32 px, dense 20 px (leading + vertical padding). `relaxed` spends half
   again as much screen per row as `default` for no legibility a QS asked for; `dense` still
   reads, but it is the step at which the queue's *reason sentence* has to be dropped to fit —
   and that sentence is what stops the surface reading as mechanical. So: three steps, and the
   shipped default is the middle. Flip the toggle before agreeing.
3. **Own the components; no library.** Three radically different layouts came out of Tailwind 4
   with zero component dependencies, and the parts that repeat are domain parts (a status glyph,
   a provenance strip, a refusal block) that no library ships. What must not be re-declared is
   the **token set** — every variant here declares its own `--vx-*` block inline, which is
   exactly the Genesis F6 smell if it survived into production. Tokens belong in one `@theme`.
4. **Tailwind 4 needs `font-(family-name:--var)`.** `font-[var(--x)]` silently does nothing —
   it cost a screenshot to notice, and it would cost a design review later.

## What only a human can settle

- **The register (tone).** A vs B vs C is a judgement about who the instrument is for, made
  against a real QS's day, not against taste. That pick is the ticket's live exchange and is
  deliberately not made here.
- **Bangla's type scale.** Two findings are already visible with the `বাংলা` toggle:
  1. Bangla's ascender/descender load needs a taller line box — `shell.tsx` sets `1.75` against
     the Latin default and it is still tight in the dense step;
  2. **the monospace stack has no Bengali coverage**, so every provenance strip, cause code and
     figure column falls back to a different face mid-line. Numerals in this prototype render
     Bengali (`৬১.২৫৬`) with lakh grouping, which is *a* choice — whether a tendered document
     carries Bengali or Western digits is a `bd-authority.md` question this prototype poses and
     does not answer.

## Capture

When a direction wins: fold it into real code (rewritten, not promoted), and move this whole
directory to the throwaway branch. Nothing here should outlive the decision.
