# The grid backbone

wayfinder:task
Status: open
Blocked by: 05-view-partition.md

## Objective

Axes in two families (letter / numeral) with per-view georeference, derived **only** from
layout-plan evidence — filtered by the ticket-05 partition *before* detection, so a grid stamp
in a detail can never shift an axis. A view without lawful bubble evidence georeferences as
**deferred with a named reason**; machine proposes, disposition stays human.

## The decision this ticket must make first

§8's content signature is "a bare letter/numeral text anchored inside a circle" — but in the
fixture (and in the CAD convention it reproduces) **a bubble's circle is derived paint**. Every
CIRCLE in the artifact carries `src`; the only original is the INSERT, which carries the label
as a block attribute (`attrs: [{tag: LABEL, text: "A"}]`) and its own world point. §3 bars
derived geometry from the extractor. So one of these must be ruled, by name:

- the circle is admissible as **corroboration** of a signature anchored on an original INSERT +
  its attributes (never as the thing that invents the bubble), or
- bubble evidence is defined on the attribute channel alone, or
- the fixture also needs free-standing bubbles (bare TEXT in an original CIRCLE) so both forms
  are covered.

Matching on the block name `GRID_BUBBLE` is not an option — same species as layer names.

## Guardrails

- `cad-ingestion.md` §8 binds verbatim. One bubble in the fixture is inserted at 1.5× scale
  deliberately: world transforms must be honoured, not assumed unit.
- Axis families are separated by the label's own form, not by which direction the line runs.
- Deferral carries a named cause from the shared taxonomy (`identity.md` §7 — one enum, two
  originators).
- Min grid spacing is computed and exposed here; ticket 07's placement constants are shares of
  it and must not recompute it.

## Exit criteria

- [ ] Both fixture revisions georeference: 3 letter axes, 3 numeral axes, positions asserted
      against the generator's own `GRID_X` / `GRID_Y`.
- [ ] A layout-plan view stripped of bubble evidence defers with a named reason; a bubble
      stamped inside a non-layout view moves no axis (assert both).
- [ ] `pnpm verify` green and under 60s.
