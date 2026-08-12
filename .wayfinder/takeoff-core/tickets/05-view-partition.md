# The view partition and the instance predicate

wayfinder:task
Status: closed
Blocked by: 04-upload-and-ingest-job.md

## Objective

Every model-space **original** entity is assigned to exactly one view; view types are the closed
vocabulary of `cad-ingestion.md` §7. `mayYieldInstances(view)` is the **one** exported decision
site, with the CI check that no second site exists. Classification follows caption grammar
(en+bn stems), never title literals; an unclassifiable caption anchors nothing and the view is
honestly `untyped`.

## The decision this ticket must make first

**The fixture set carries exactly one view** — a layout plan with a single `TYPICAL FLOOR PLAN`
title. Against it, "only layout-plan-class views may yield instances" is asserted against
nothing: no schedule to refuse, no `PLAN OF <subject>` member-scoped plan to prove
never-countable (§7's named trap). Either extend `gen_structural.py` with at least a schedule
view and a member-scoped detail, or the predicate lands untested. Extending reopens ticket 03's
pinned guarantees — the sanity number (34/48/`{POINT: 4}`) and the fixture sha256 pin move, and
both revisions must move together. Decide, record the ruling and the new pinned numbers in the
resolution.

## Guardrails

- `cad-ingestion.md` §7 binds verbatim. Derived entities are not partitioned — §3's extractor
  invariant means only originals (`src is None`) carry membership.
- Caption grammar, never layer names and never block names (the §8/§10 species rule: a
  drawing-specific literal may corroborate, never add or re-assign a role).
- The partition is total and disjoint on originals — an entity no caption claims lands in
  `unassigned`, named, never dropped.
- No grid, no placement, no register writes here.

## Exit criteria

- [ ] Every original entity in both fixture revisions lands in exactly one view; the counts are
      asserted, not eyeballed.
- [ ] A non-layout view refuses to yield instances, asserted through the single predicate; the
      CI check for a second decision site is red when a second site is introduced (test it).
- [ ] An unclassifiable caption produces an `untyped` view with a named reason, never a guess.
- [ ] `pnpm verify` green and under 60s; the fixture ruling and pinned numbers recorded.

## Resolution

**The fixture was extended.** The predicate untested was the worse trade: §7's whole point is
that a schedule's `C1` cell and a plan's `C1` mark are the same string in different views, and
nothing proves that without both in one drawing. `gen_structural.py` now draws a four-view
**sheet** in both revisions — the floor plan, a `COLUMN SCHEDULE` whose cells repeat the plan's
marks and the block-internal size strings, a `PLAN OF PILE CAP PC-1` member-scoped detail whose
two pile circles read exactly like countable members, and an `SK-04 REF. AS-BUILT` caption the
grammar cannot classify — plus one stray line parked far outside every view. The alternative
(a second, schedule-only fixture drawing, leaving 34/48 untouched) was put and rejected: a
sheet where the schedule is the whole drawing tests classification but not the *partition*, and
the traps §7 names only exist when the views share a sheet.

**Re-pinned, deliberately (§12): 59/49/`{POINT: 4}`**, both revisions regenerating
byte-identically (`4a2d5f88…` / `1c84beb8…`). `structural-r2.entitygraph.json` is now committed
too — the TS side reads both revisions and does not run the pipeline. Six python assertions
moved and every one **tightened** rather than loosened: block-internal paint is now told from
schedule text by `src` alone (the strings are identical), the bubble-radius and colour tests
scope to derived paint against the detail's original circles, and the revision-pair test asserts
the delta as a `Counter` difference (`+C4`, `−C1`) instead of two hardcoded lists.

**`mayYieldInstances` admits `layout_plan` only** — narrower than the legacy pipeline, which
also admitted `stair_plan` as the stair family's layout-plan analogue. A stair plan repeats
columns and walls the floor plan already places, and nothing here yet separates the stair's own
members from those repeats; under-measuring a stair and saying so is the lawful side of the
asymmetry. The stair lane re-opens that line, and `src/__tests__/view-law.spec.ts` proves no
other site may.

**The partition is coverage-band, not cluster:** x-interval union → y-interval union within each
column → cells, captions anchoring cells, an entity belonging to the nearest caption at or below
it. Two findings forced by measurement, both recorded because they cut against the obvious
design:

- **The band gap is keyed to the caption height, not the body text.** Keyed to body text it is
  narrower than a schedule's own column spacing (3500 against a 150 annotation), so the table
  shatters into columns — the fixture only held together because the detail below it happened to
  bridge the gap. The air a drafter leaves between views scales with the titles. Measured window
  on this sheet: **5 to 16.5 caption-heights; the default is 12**, and the sweep test pins it.
- **The caption-reach fold was deleted, not shipped.** Once the gap was title-scaled, no caption
  could ever sit outside its own view's band, so the fold was unreachable — a dead path that
  would have gone untested into ticket 06.

Two defects the tests caught and the fixture could not: a `(R1)` revision tag read as a member
mark, classifying every revised floor plan as a detail; and an entity dropped outright when the
sheet-frame guard withheld every coverage interval — the law's own sin, now covered by a
synthetic graph. The safety property is asserted directly: **across a band gap from 3 to 30 the
layout plan never *gains* an entity** — mistuning costs it members, and the `unassigned` bucket
says so by name, but it never hands the plan a schedule cell.

Landed: `src/modules/takeoff/views.ts` (the vocabulary, the caption grammar with en+bn stems,
the predicate, the partition), `views.spec.ts` (37), `src/__tests__/view-law.spec.ts` (4, the
second-site check proven to fire). `pnpm verify` green in **8.2s**. Ticket 06 inherits a grid
bubble stamped inside the detail, so §8's "a detail's grid stamp never shifts an axis" is
provable without re-pinning these fixtures again.
