# The design system — what a quantity surveyor's instrument looks like

wayfinder:prototype
Status: closed
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

## Prior attempts — read as argument, never as decision

This ticket was executed AFK twice before ADR-0015 existed. Both are unmerged and stay that way.
Neither is deleted, because the thinking is worth reading and a deleted branch is unreachable
history:

- **`be827f1`** — landed as #42 (closed ticket, ADR numbered 0015, prototype merged to `main`),
  reverted wholesale by #46. The variants, fixtures and canvas this ticket's branch started from
  are recovered from it. **This is the run that ruled**, which no unattended session may do.
- **`abb4651`** (branch `claude/design-system-k0fpxm`, 2026-08-13 21:25) — a second run, 37
  files, never opened as a PR. **This one did not rule**, and the correction is worth keeping:
  its ticket edit left `Status: open` under a heading reading *"Prototype (built, not resolved)"*,
  and its commit message says so in terms — *"the ticket stays open and stays claimed: the
  register pick is the live exchange this artifact exists to raise, and the session that built it
  does not answer its own question."* It stopped exactly where ADR-0015 would later require.
  (Corrected on merge by the attended session that ruled this ticket; the section as landed said
  both runs ruled.)

`git show <sha>` reads either. **They are arguments, not decisions**, and the attended session
that rules this ticket owes them a reading, not deference — ADR-0015 records that the flow had
no standing, not that the artifact was wrong.

**The reading, discharged.** `abb4651` reached two conclusions independently that the attended
ruling below also reached, by a different route and from a different artifact: *colour is never
the only channel*, and *components owned, with **tokens** rather than components as the Genesis F6
risk*. Convergence from an independent run is not proof, but it is the cheapest corroboration
available and it is recorded rather than discarded. Where it differs: it proposed a **three-step**
density scale (relaxed / default / dense) against the two-step scale ruled below, and it put
compact `L`/`Cr` in one screen-chrome tile — permitted, since `CLAUDE.md` bans it on a *document*,
but not carried forward.

## The prototype was rebuilt before it could be ruled (attended, 2026-08-16)

The dispatcher opened the session, looked at the three variants, and could not answer: *"rebuild
A, B, C with more combination as I'm confused with lack of clarity and can't answer you properly
right now."*

**That was the artifact's fault, and naming it is the first finding.** Each of A, B and C decided
four things at once — surface tone, where the drawing sits, how work arrives, where the document
lives. So "which one" had no honest answer, because the answer was always going to be *one
direction's chrome with another's structure*, and nothing on screen could express that. Three
bundles is not three options; it is one option asked three ways.

Rebuilt (39e62a5) as **two separable axes with the directions as presets on the grid**:

```
surface  paper | slate | duo (light chrome, dark viewport)
shell    split | stage | docket
density  compact | comfortable          <- point 2, which no prose can settle

     |  split            stage                docket
paper|  A Drafting Table   ·                  C The Docket
slate|  ·                  B Instrument Console  ·
duo  |  D Lit Table        ·                  E Case Stage
```

`?surface=` · `?shell=` · `?density=` · `?lang=` · `?mono=`; keys `s` `h` `x` `b` `m`, `←`/`→`
presets, `j`/`k` walk the queue. The switcher reads **off-grid** once you leave a named point —
which is where the ruling landed.

Three repairs the comparison itself needed:

- **Every shell now shows every surface** — canvas, worklist, bill, certificate, act log. Before,
  B hid the bill and C showed a single docket, so a reviewer was comparing a shell against a
  shell *plus a bill*.
- **The shared surfaces are written once and themed** (`parts.tsx`). A shell switch now puts only
  the arrangement on trial, not two accidentally-different bill tables.
- **Stage's docks push rather than float.** Overlaying the canvas meant that shell could only ever
  be rejected for occluding the drawing it claims to be about — a layout defect standing in for
  the axis under test.

## Resolution

Ruled in an attended `/grilling` session, one question at a time, in front of the running route.
Six questions, six rulings.

### 1 + 5. The register and where the drawing sits — **duo × stage. Off-grid.**

Not a preset. Light chrome with a dark viewport (`duo`), and the drawing as the page with the
worklist docked beside it (`stage`) — a coordinate no named direction occupied, which is precisely
what the rebuild existed to make sayable. Points 1 and 5 were put as one question because no
variant let them move separately, and the answer proves they had to: the tone came from one
direction (D's surface) and the structure from another (B's shell).

The drawing is a different kind of object from the bill and the surface now says so: the viewport
is a viewport, every document plane stays paper and survives being printed and held next to a real
sheet. Ruling out a wholly dark register kills the re-adaptation cost on every glance down at a
printed drawing; ruling out a wholly paper one refuses to pretend a CAD canvas is a document.

**The measurement that forced the shell:** in stage's 24rem dock at 1680×1050, a QS sees **2.6
subjects at a time in English and 2.3 in Bangla**. That is the price of giving the drawing the
page, it was put explicitly, and it was accepted.

**Alternative put and rejected:** A-with-C-as-a-mode (the resolving session's own recommendation,
`paper × split` with the docket as an inner mode), and D (`duo × split`). Both keep a persistent
worklist and were rejected with the 42% cost of a permanent list in view.

### 2. Density — **compact, ruled in English.**

28px row · 36px for a citation row · 13px data · 11px label. Bangla steps its own **type** (+1px,
1.7 leading) and never its own **row height**: a Bangla screen shows ~13% fewer subjects than an
English one and that is accepted rather than equalised.

**The measurement that forced it** — seven queue rows, duo × stage, 1680×1050, 384px dock:

| | English | Bangla | Bangla cost |
|---|---|---|---|
| compact (28/13/11) | 1307px | 1484px | **+13.5%** |
| comfortable (34/14/12) | 1503px | 1825px | **+21.4%** |

**The Bangla penalty grows as the scale loosens** — 13.5% → 21.4%, because Bangla's size step and
1.7 leading compound against a larger base. So ruling the scale in Bangla to buy parity is
perverse twice over: it costs every English screen ~15% of its worklist *and* widens the very gap
it was meant to close. Parity of subjects-per-screen is not a value a QS holds; legibility is, and
Bangla keeps its type step, which is the legibility half.

**Rider ruled at the same time:** a quoted source string **never breaks across lines**. In Bangla
at 384px the machine's proposal wrapped inside the drawing's own quoted title block —
`টাইটেল ব্লক "STRUCTURAL / LAYOUT" থেকে`. A verbatim quotation broken in half is a small lie about
what the drawing says, and checking it against the sheet is the only reason the citation exists.

### 3. Bilingual numerals — **Western everywhere, in both languages. Grouping stays lakh/crore.**

The signed-document argument is the ticket's own: a figure that renders differently per reader's
locale is a second number on a document read by two parties.

**The measurement that forced it** is the one the build surfaced — *the boundary between "prose
count" and "figure" cannot be stated.* On one screen the prototype renders `০.৯৪` (a confidence),
`৬টি ভিউ` (a count), `১:১০০` (a scale), `সবকটি 2 অনুমোদন` (a count that came out Western because
it went through a template), and every quantity, rate and amount Western. Five cases, four
policies, none of them decided by anyone. A rule that cannot be stated cannot be enforced and gets
relitigated per string forever.

**Alternative put and rejected:** Bangla numerals in Bangla prose, Western in figures. It is what
a Bangla reader expects and it makes the Bangla surface native rather than translated — a real
cost, accepted, because it lands on prose while the benefit lands on the artifact that gets signed
and disputed.

**Ruled against an unestablished fact, and that is disclosed:** nothing in this repo rules script
on a document — `bd-authority.md` has no language clause and `quantity-contract.md` §6 governs
channels, not script. Whether e-GP mandates a script on a submitted BoQ is unknown here. Minted as
`inbox/egp-script-and-numeral-requirements.md` at the dispatcher's instruction; if statute
contradicts this, statute outranks it and this ruling is revisited, not defended.

### 4. Colour is never the only channel — **a standing requirement, both layers.**

A table-driven unit test asserting every mark renders glyph *and* word for every enum member, **and**
a lint rule forbidding a status colour token outside the marks module with a meta-test proving it
bites. The repo already has both shapes: `eslint.config.js:63`'s `NO_LOCALE_COMPARE` and
`src/__tests__/boundaries.spec.ts`, which exists to prove the lint rules fail closed.

Layer 1 alone proves the component is correct, not that nobody rendered a bare coloured `<span>`
beside it — and that gap is exactly where the violation appears.

**Alternatives put and rejected:** a greyscale visual snapshot test (needs a browser, threatens the
90s bar, and goes red on every legitimate layout change — which trains people to re-baseline
without looking; a check people learn to dismiss launders the dismissal), and convention plus
review (ADR-0015's measurement: #44 disclosed its own violation unprompted and correctly, and the
next human reverted the wrong line anyway).

Constitutional, so it carries an ADR: **ADR-0016**.

### 6. Enum values on a bilingual document — **both, with the code subordinate.**

`formulas.md` §6 already rules that reason codes are stable identifiers which translate to Bangla,
so only the residual was open: whether the code stays visible beside its translation. It does —
translated label at prose size, code in mono at label size beside it — **on the certificate as
well as on screen**. The prototype was inconsistent between the two (the scope panel showed both,
the certificate dropped the code) and the certificate follows the panel, not the reverse.

A translation is contestable: two parties can disagree that `প্রকল্পের পরিধির বাইরে` means exactly
`NOT_IN_PROJECT_SCOPE`. The code is not, and it makes one row read identically to a Bangla QS, an
English engineer and a CSV parser — which is `quantity-contract.md` §6's every-channel requirement
pointing the same way.

**Alternative put and rejected:** translated label only on the document. Cleaner, and the
bilingual-noise objection is real; rejected because the moment the code is absent the document
stops being self-identifying and starts depending on a glossary nobody attached to it.

### The stack — **tokens declared once; headless underneath; components owned; vendor deferred.**

Tokens live in `globals.css`'s `@theme` and are consumed as Tailwind utilities — one declaration
site, Genesis F6 applied to the vocabulary that carries the certificate. **The prototype is the
counter-example on purpose** and must not be copied: `theme.ts` holds three palettes and threads
them through inline `style={}`, because a CSS `@theme` block holds exactly one palette and the
comparison needed three at once.

No styled component library, ever — it is a second design system arguing with this one forever.
Headless behaviour may ride underneath, because it declares behaviour and not vocabulary. The
components this instrument still lacks are the interactive ones (deferral dialog, cause combobox,
listbox with roving tabindex, ARIA on a dense grid) and this is a keyboard-driven tool read for
eight hours — but **the vendor is deliberately unnamed**, because nothing in the product uses a
dialog or a combobox yet and a vendor chosen against zero usage is chosen on taste. Lean on
record: React Aria Components, the only candidate with real `Table`/`GridList` keyboard semantics.
Minted as `inbox/the-headless-component-vendor.md`, to be taken by the first ticket that needs a
focus-trapped dialog with that component in front of it.

Also in ADR-0016.

### What was deliberately not done

**The prototype is left contradicting the ruling, and that is correct.** It still shows both
numeral policies at once, still breaks the quoted title block in Bangla, still holds palettes in
`theme.ts`. It is the **exhibit** — the evidence that produced these rulings — and overwriting it
with its own conclusions destroys the primary source (UI.md: the full variant set is the primary
source and lands on a branch, not in the bin). Folding the winner into `globals.css`, writing the
two enforcement layers, and dropping the losing coordinates from `main` is **implementation**, and
belongs to the first real surface.

### Attendance, disclosed

`Claimed by:` was **empty on `main`** when this session opened, and it is named here rather than
worked around. #59 landed the argued reading — empty is unattended, fail-closed, and a session may
not infer attendance from being able to see a terminal — but ticketed it rather than ruling it, and
the mechanism ADR-0015 §5 describes **does not exist**: there is no `--attended` flag in
`scripts/dispatch.mjs` and no HITL check in `.github/workflows/ci.yml`. This session was genuinely
attended — six questions, six answers, every ruling above is the dispatcher's and none is the
agent's — and #59 also holds that nothing should block a human in-session. The gap is real and the
merging act should be informed of it, which is what this paragraph is for.
