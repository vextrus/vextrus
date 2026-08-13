# The design system — what a quantity surveyor's instrument looks like

wayfinder:prototype
Status: open
Blocked by:
Claimed by: dispatched 2026-08-13

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

## Prototype (built, not resolved)

`src/app/prototype/design-system/` — three variants on `/prototype/design-system`, switchable
with `?variant=A|B|C`, plus `?lang=en|bn`, `?density=relaxed|default|dense` and a greyscale
toggle. `pnpm dev`, then open the route; the README beside the code is the reading guide.

**This ticket stays open and stays claimed.** It is `wayfinder:prototype` — HITL — and the
register pick (§1) is a judgement about who the instrument is for, made in a live exchange. The
session that built the artifact does not get to answer its own question, so it did not: the
variants argue three different cases (canvas-first · disposition-first · document-first) with
real domain content, and the pick is the human's.

What the artifact settled on evidence rather than taste, and what a resolution should ratify or
overturn:

- **§4 colour is never the only channel** — status rides fill pattern + outline + glyph + a
  named cause code, and the greyscale toggle is the standing check. This survived; a tint did not.
- **§2 density** — a three-step scale (`density.ts`), computed row boxes 48/32/20 px, `default`
  shipped. `dense` is the step at which the queue's reason sentence stops fitting, which is the
  step at which the surface starts reading mechanical.
- **§3 the stack** — components owned, no library: three radically different layouts came out of
  Tailwind 4 with no component dependency, and the repeated parts are domain parts nobody ships.
  The Genesis F6 risk is not components but **tokens** — each variant declares its own `--vx-*`
  block, which must collapse into one `@theme` before any of this is real.
- **§6 bilingual** — two findings, both visible on the `বাংলা` toggle: Bangla needs a taller line
  box than the Latin scale (1.75 and still tight at `dense`), and **the monospace stack has no
  Bengali coverage**, so every provenance strip and cause code breaks face mid-line. Numerals
  render Bengali with lakh grouping here; whether a *tendered document* carries Bengali or
  Western digits is a `bd-authority.md` question this poses and does not answer.

§5 (the drawing is the hero) is the one the pick turns on and is left open by design: A gives the
sheet the whole room, B keeps it larger than the list it serves, C demotes it to pinned evidence.
