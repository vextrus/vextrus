# The design system — what a quantity surveyor's instrument looks like

wayfinder:prototype
Status: open
Blocked by:
Claimed by:

## Objective

Frontend is genuinely zero: `src/app/` holds a layout, a home page, a login page and a sign-out
button. Before any surface is built, settle the visual and interaction language — by building a
cheap artifact, not by arguing. This is the ticket the CEO's brief asked for prototyping on.

## The decision

1. **The register (tone).** Vextrus is an instrument for civil engineers and quantity surveyors
   producing documents that get signed and tendered. The brief asks for *modern but most
   professional*. Prototype at least two distinct directions and pick against the domain, not
   against taste — a takeoff tool is read in an office, on a large monitor, for eight hours, and
   next to a printed drawing.
2. **Density.** A disposition queue is a dense worklist and a bill is a dense table. Consumer
   spacing wastes a QS's screen; spreadsheet density is hostile. Rule a scale.
3. **The stack.** Tailwind 4 is already installed. Rule whether a component library rides on top
   (and which — headless vs styled), or whether components are owned. Genesis F6 warns against
   vocabulary re-declared in many places; the same logic applies to design tokens.
4. **Colour is never the only channel.** `quantity-contract.md` §6 requires the certificate to
   ride every export channel and **never be carried by colour alone** — a tint dies in greyscale
   and print. That is a design-system constraint, not a document one.
5. **The drawing is the hero.** Charting ruled disposition-first *with canvas-first as a
   first-class secondary*. Legacy's disposition surface **felt mechanical** — that is the named
   risk this ticket exists to kill. The canvas must not read as a thumbnail beside a form.
6. **Bilingual shape.** Bangla and English (genesis §5). Prototype at least one screen in Bangla
   — Bangla script has different line-height and numeral needs, and discovering that after the
   type scale is set is expensive.

## Guardrails

- Throwaway artifact; nothing here is production code. `/prototype` is the skill.
- Numbers render lakh/crore, never `toLocaleString('en-US')`; compact `L`/`Cr` **never** on a
  document (`CLAUDE.md`).
- Show real domain content — a refusal with a named cause, a partial-coverage line, a
  scan-derived `INTERPRETED` line. A design system proven on lorem ipsum proves nothing.

## Blocks

Tickets 14, 15 and 16 are all downstream of this.

## The artifact is built; the ruling is not made (AFK reading, 2026-08-13)

An unattended session may work a HITL ticket **for facts and must stop at the first decision**
(ADR-0015 §1–§3). This is that stop. The prototype is on the branch and running; nothing has been
ruled, no ADR was written, and no line of it was folded into production code. **Nobody has chosen
a direction — that is the exchange this ticket still owes.**

### Run it

```
pnpm dev   # then http://localhost:3210/prototype/design-system
```

`?variant=A|B|C` · `?lang=en|bn` (key `b`) · `?mono=0|1` (key `m`). Variant C is keyboard-driven
(`j`/`k` move the docket, `a`/`d` dispose) and is the only one with live state.

- **A — Drafting Table**: paper register; canvas ∥ worklist as a persistent 58/42 split, bill and
  certificate as a drawer beneath both.
- **B — Instrument Console**: dark CAD register; the canvas *is* the page and the docks float
  over it.
- **C — The Docket**: one judgement at a time, full-width evidence above it, the absence ledger
  as the page's headline and a visible append-only act log.

Everything on screen is domain-real (guardrail 3): an unpriced `DERIVED` line, an `INTERPRETED`
`PARTIAL_DECLARED` line with its omissions enumerated on the row, a row that keeps its place with
**no quantity**, four declared exclusions each carrying a named cause, the by-sheet interpreted
disclosure, a crore-grouped measured-scope subtotal with **no grand total**, and seven queue acts
the domain law already requires (discipline, scale, georeference, note transcription, a
plan-vs-schedule discrepancy that is a hard block, a level carry, a 94-subject batch).

### Provenance — this is recovered work, not new work

Ticket 10 was executed once before by a conducted worker, landed as #42 (a closed ticket, an ADR
numbered 0015, and the prototype merged to `main`), and reverted wholesale by #46. ADR-0015 —
the one that now occupies that number — records *why*: the flow had no standing, not that the
artifact was wrong. The variants, fixtures and canvas are recovered from `be827f1` and re-run
here, on a branch, with the ruling deliberately absent. `git show be827f1` is the primary source
for what that session concluded; **read it as an argument, not as a decision.**

Two things #42 folded into production are deliberately **not** restored: `src/app/globals.css`'s
`@theme` token block (now `prototype.css`, imported by the route alone) and `src/core/format.ts`
(now `format.ts` beside the variants). Both are ruling-shaped. `globals.css` on this branch is
byte-identical to `main`.

### What building it settled — facts, not rulings

- **The `mono=1` test is real and all three pass it.** Every status is a triple — glyph, word,
  then colour — so `quantity-contract.md` §6 survives greyscale. This is the one constraint the
  prototype can *verify* rather than propose, and it is cheap to keep as a standing check.
- **Bangla costs ~15% of a worklist column and ~20% of a bill row.** Measured on variant A at
  1680×1050: seven queue rows total 899px in English against 1036px in Bangla; bill rows go
  45→54px (the two-line citation row 62→74px). A density scale ruled on English alone is
  wrong by that much on every Bangla screen.
- **A Bangla screen is mixed-script by construction, and no ruling avoids it.** A machine
  proposal quotes the drawing's own text and its source keys, and a BD structural sheet is
  lettered in English: `structural — টাইটেল ব্লক “STRUCTURAL LAYOUT” থেকে`, `S-118 rev A`,
  `1:100`, `@unregistered:“ROOF LVL”`. The type scale has to hold Bangla prose and Latin marks
  on one line, at one baseline.
- **The bill's dense surfaces had never been seen in Bangla.** #42's `lang=bn` swapped in a
  Bangla *certificate* and hid the queue and the table — the two surfaces the type scale is
  actually under load on. Extended here: queue rows, bill rows, column heads and act chrome all
  render bilingually in all three variants (`queueText()` and `bn.ui` in `fixtures.ts`).
- **One rendering defect fixed:** the raster note was drawn inside the SVG at world scale and
  collided with the figcaption and the dimension string on any short canvas box (visible in C).
  The bottom-left gutter now has one owner.
- `pnpm verify` is green with the route in the tree (63.8s), and the switcher is gated on
  `NODE_ENV !== "production"`.

### The questions, sharpened — each one still needs a human

1. **Register (tone).** Three directions exist to be looked at. The axis that the artifact makes
   concrete: B's docks *occlude the drawing they float over*, and its worklist reads as a
   dashboard — which is the "felt mechanical" failure named in point 5. Whether that disqualifies
   B, or is a fixable layout detail, is a judgement about how a QS works, not a fact on screen.
2. **Density.** A number is needed, and the prototype proposes one: 28px worklist/bill row, 36px
   for a row carrying two lines of citation, 13px data / 11px label. Confirm, or move it — and
   say whether the scale is ruled in English and pays the Bangla 15% in extra height, or is ruled
   in Bangla and runs loose in English.
3. **The stack.** Untouched by this session and still open: components owned vs a headless
   library underneath. Nothing in the prototype forecloses either — it is Tailwind 4 and plain
   elements. Genesis F6's argument (one declaration site for a token) is about *tokens*, and does
   not by itself decide the component question.
4. **Colour never alone.** Verified, not ruled: `?mono=1` passes today. The decision left is
   whether that check becomes a **standing** requirement with a test, or a convention.
5. **The drawing is the hero.** All three keep the canvas above thumbnail size; they disagree
   about whether it is a partner (A), the page (B), or evidence framed per judgement (C). This is
   the disposition-first / canvas-first balance from charting, made visual.
6. **Bilingual shape.** Two questions the build surfaced that the ticket did not anticipate:
   - **Numerals.** The prototype deliberately shows *both* policies at once — prose counts in
     Bangla digits (`০.৯৪`, `৬টি`) while every quantity, rate and amount stays Western. On a
     signed document read by two parties, one figure in two scripts is a second number. Rule it.
   - **Enum values.** `MEASURED`, `PARTIAL_DECLARED`, `NOT_IN_PROJECT_SCOPE`, `BLOCKS INGESTION`
     render in English in both languages, because they are domain-law values, not prose —
     while `formulas.md` §6 says reason codes translate. The Bangla certificate translates the
     *cause labels* and the queue does not: that inconsistency is on screen, and it is a ruling
     about what a value is versus what a label is.

### Where the decision goes when it is made

`## Resolution` on this ticket, `decisions/10-the-design-system.md`, and — if the ruling is
constitutional — a new ADR at the next free number (0015 is taken; do not reuse it). Folding the
winner into `globals.css` and `src/core/format.ts` is *implementation*, and per UI.md the losing
variants and the switcher leave `main` when it happens.
