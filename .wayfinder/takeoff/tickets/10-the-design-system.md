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

Prototyped two directions at `src/app/prototype/design-system/` (`?variant=A|B`, floating +
keyboard switcher, real content: MEASURED/DERIVED/INTERPRETED lines, an unpriced row, a
`NOT_IN_PROJECT_SCOPE` exclusion, the interpreted-sheet disclosure, a crore-grouped subtotal, one
Bangla panel). **A — "Drafting Table" wins**: canvas+worklist as a persistent 58/42 split (never
a thumbnail, disposition stays primary), paper-toned surface for 8h next to a printed drawing; B's
dark "Instrument Console" read closer to the mechanical legacy surface this ticket exists to kill.
Ruled and folded into real code: density via `--spacing-row`/`--font-size-data` tokens
(`globals.css` `@theme`), components owned — no library, Tailwind alone (genesis F6's
one-declaration-site logic applied to tokens), colour never alone (`status-badge.tsx` pairs a
glyph with every basis/coverage colour), Bangla gets its own `--line-height-bangla`, and
`formatTaka` (`src/core/format.ts`, lakh/crore grouping, unit-tested) for 14–16 to reuse — never
`toLocaleString`, never compact `L`/`Cr`. Deviation from `/prototype`'s SKILL.md step 6: the full
variant set could not be pushed to a separate throwaway branch (CLAUDE.md forbids branch creation
this session), so both variants stay in this branch's tree/history as the primary source instead.
Unrelated fix folded in: the repo root had several zero-byte device-node "dotfiles" (`.gitconfig`,
`.idea`, …) that made Tailwind's content scanner panic `next build` with EACCES on any CSS import,
pre-existing and reproduced on a pristine `globals.css`; now named explicitly in `.gitignore`.
