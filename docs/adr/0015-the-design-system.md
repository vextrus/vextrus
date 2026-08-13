# ADR-0015 — The design system: a paper-register instrument, tokens owned, colour never alone

**Date:** 2026-08-13 · **Status:** accepted

## Context

`.wayfinder/takeoff/tickets/10-the-design-system.md`. Frontend was genuinely zero — a layout, a
home page, a login page — and tickets 14 (the disposition queue), 15 (the canvas) and 16 (the
bill and the certificate) are all downstream of the visual and interaction language. The brief
asked for *modern but most professional*, and named the risk from experience: **the legacy's
disposition surface felt mechanical.**

Settled by building, not by arguing. Three directions were prototyped on one throwaway route
(`src/app/prototype/design-system/`, `?variant=A|B|C&lang=en|bn&mono=0|1`), each rendering the
same QS day on real domain content — a `MEASURED` line, a `DERIVED` line published **unpriced**
because an item-selecting attribute is missing, an `INTERPRETED` line at `PARTIAL_DECLARED` with
its omissions enumerated, a row that keeps its place with **no quantity**, four declared
exclusions with named causes and their per-member originator legality, the interpreted-sheet
disclosure, a crore-grouped measured-scope subtotal with no grand total, and a disposition queue
holding the acts the domain law already requires.

- **A — Drafting Table.** Paper register. Canvas and worklist as a persistent 58/42 split; the
  bill and its certificate as a document drawer under both.
- **B — Instrument Console.** CAD register. Near-black, the canvas is the whole page, panels
  float over it.
- **C — The Docket.** Case-file register. One judgement at a time, evidence full-width above it,
  the absence ledger as the page's headline, act log filling as you work.

## Decision

**1. Register: A, the paper direction, with C's absence headline and act log folded in.**
A takeoff tool is read on a large monitor for eight hours *next to a printed drawing*, and it
produces a document that gets signed and tendered. The surface should look like that document:
paper-toned (never `#fff`, which glares next to a printed sheet), hairline rules, ink and muted
ink, colour used sparingly and never load-bearing.

B is rejected on evidence, not taste. Its docks occlude the drawing they float over — the
prototype's own screenshot loses the grid bubbles behind the status strip and a quarter of the
sheet behind the queue dock — and a dark UI forces a re-adaptation on every glance down at a
white printed sheet. Its register is also precisely the chip-and-counter dashboard voice ticket
14 exists to kill. Retained from B: a dark ground is legitimate *inside* the canvas pane, where
white-on-dark line work genuinely reads better; that is a canvas setting, not the app's register.

Retained from C, and binding on ticket 14: **absence is the headline, not a footnote** — the
count of `(class × kind)` cells with no line and no cause belongs above the worklist, because a
queue of rows can never show it; and the **act log is visible while you work**, since attribution
is derived from it and never stamped on rows.

**2. Density: a ruled scale, in tokens.** `--spacing-row: 1.75rem` for a dense bill/queue row,
`--spacing-row-loose: 2.25rem` where a row carries two lines of citation, `--font-size-data:
0.8125rem` for quantities and marks, `--font-size-label: 0.6875rem` for column heads and status
marks. Prose keeps its natural scale; only data rows are compressed. Quantities are tabular-nums
and right-aligned — a column that does not align on the decimal cannot be scanned.

**3. Stack: components are owned; Tailwind 4 alone; no styled component library.** The surfaces
that decide this product — a canvas, a dense disposition worklist, a bill whose cells carry
basis and coverage marks — are in no library's vocabulary, and every styled kit ships a spacing
and colour default that would fight the density scale above. A **headless** primitive (dialog,
menu, combobox, popover) is permitted later where accessibility is genuinely hard to own, and
only headless: it may contribute behaviour, never a token. Tokens live in one `@theme` block in
`src/app/globals.css` — genesis F6's finding was domain vocabulary re-declared in nineteen
places, and a colour or spacing re-typed at every call site fails the same way.

**4. Colour is never the only channel.** `quantity-contract.md` §6 makes this a design-system
constraint, not a document one: a tint dies in greyscale and print. Every status renders as a
triple — **glyph, word, then colour** — with solid marks for what was read, hollow for what was
guessed, a dash for what nobody looked at; blocking work carries a leading bar *and* the words
"blocks ingestion". The prototype's `?mono=1` renders any variant through a greyscale filter and
is the standing test: strip the colour and the surface must still read. It does.

**5. The canvas is a first-class partner, never a thumbnail.** In the ruled layout it holds 58%
of the working area permanently — not a panel that opens, not a preview that expands. A
disposition cites source keys and the viewport frames and highlights them; **highlight never
mutates the drawing**. A raster sheet renders as an image beneath a traced vector layer, and the
two never share a channel.

**6. Bilingual shape.** Bangla hangs its glyphs below the matra and stacks conjuncts vertically,
so it steps up one size (`--font-size-bangla-body: 1rem`) and runs a looser leading
(`--leading-bangla: 1.7`) against Latin's 1.3 — a shared line-height crowds it. **Figures never
step**: a quantity keeps the Latin data size in both languages. **Numerals stay Western in both
languages on a document** — a signed bill is read by two parties, and a numeral set that changes
with the reader's locale is a second number. Grouping stays lakh/crore in both, because grouping
is a convention, not a glyph set.

**7. Money and quantity formatting has one declaration site**: `src/core/format.ts`
(`formatTaka`, `formatQuantity`). Lakh/crore grouping, decimal strings in and out, never a
float, never `toLocaleString('en-US')`. There is deliberately **no** compact `L`/`Cr` function at
all — §6 forbids it on a document, and the cheapest way to keep it off one is to have no code
that produces it. The formatter refuses rather than rounds: rounding to a per-kind precision is
the document's arithmetic decision, taken before extension, not a side effect of a string layer.
It sits in `src/core` because the queue, the bill and the server-generated PDF all need it and
`src/core` is the only place all three may import from — the assumption named here so a later
document module can claim it.

## Consequences

- Tickets 14, 15 and 16 build against these tokens and marks; they do not re-rule tone, density,
  or the status channel, and they may not introduce a styled component library without
  superseding this ADR.
- Ticket 14 inherits two bindings: absence above the worklist, and the act log visible while
  working.
- The prototype route is throwaway and stays in this branch's history as the primary source
  (SKILL.md step 6); its variants are not production code and are not to be promoted as written.
- `?mono=1` is retained as the cheap regression test for the colour-alone rule; any new status
  channel is checked through it before it lands.

### Deviation from `/prototype`'s SKILL.md step 6

The losing variants belong on a throwaway branch. CLAUDE.md forbids this session creating or
switching branches, so all three variants remain in this branch's tree and history instead. The
tree, not a separate branch, is the primary source for the losers.
