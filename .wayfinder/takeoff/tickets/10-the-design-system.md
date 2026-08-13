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

## Build note

Three directions prototyped on one throwaway route — `src/app/prototype/design-system/`
(`?variant=A|B|C`, `?lang=en|bn`, `?mono=0|1`; `pnpm dev` →
http://localhost:3210/prototype/design-system). Judged on real domain content, never lorem
ipsum: a `DERIVED` line published **unpriced**, an `INTERPRETED` `PARTIAL_DECLARED` line with its
omissions enumerated, a row that keeps its place with **no quantity**, four declared exclusions
with named causes (`NOT_IN_PROJECT_SCOPE` human-attributed, `NOT_ESTABLISHED`,
`INGESTION_TRUNCATED`, `ENTITY_TYPE_UNHANDLED` machine), the interpreted-sheet disclosure, a
crore-grouped measured-scope subtotal with no grand total, and a queue holding the acts the
domain law already requires (discipline confirmation that fails closed, scale per family, a
georeference deferral with a named reason, a per-sheet transcription, the `@unregistered:` one-hop
carry, the adversary's 12-columns-9-marks discrepancy).

**A "Drafting Table" wins**, with C's two best ideas folded in. B "Instrument Console" lost on
evidence: its floating docks occlude the drawing they float over (visible in its own render), and
a dark CAD register speaks in the chip-and-counter dashboard voice ticket 14 exists to kill. From
C "The Docket": **absence is the headline** — the count of `(class × kind)` cells with no line and
no cause sits above the worklist, since a queue of rows can never show it — and the **act log is
visible while you work**. Both are binding on ticket 14.

The full ruling — register, density scale, stack (components owned, Tailwind alone, headless-only
primitives permitted later, never a styled kit), colour-never-alone, canvas as a first-class
partner, and the bilingual type scale — is **`docs/adr/0015-the-design-system.md`**; tickets 14,
15 and 16 cite it rather than this note. Folded into real code: the `@theme` token layer in
`src/app/globals.css`, and `src/core/format.ts` (`formatTaka`/`formatQuantity`, lakh/crore,
decimal strings, no compact `L`/`Cr` function exists at all) with `src/core/__tests__/format.spec.ts`.
`?mono=1` renders any variant in greyscale and is retained as the standing test for
`quantity-contract.md` §6's colour-alone rule.

Deviation from `/prototype` SKILL.md step 6, named in the ADR: the losing variants could not be
pushed to a throwaway branch (CLAUDE.md forbids this session creating or switching branches), so
all three stay in this branch's tree and history as the primary source.
