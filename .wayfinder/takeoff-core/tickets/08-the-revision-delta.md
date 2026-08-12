# The revision delta — the destination test

wayfinder:task
Status: closed
Claimed by:
Blocked by: 07-placement-and-first-identities.md

## Objective

Ingest `structural-r2.dxf` against the same project and prove the moat: unchanged members keep
their identity keys, changed members re-present, nothing orphans. The register reports a
**delta**, not a do-over. Each derived row carries its order-normalized **semantic** (canonical
JSON including cited evidence handles) as the invalidator — unchanged semantic carries human
dispositions forward; changed semantic re-presents for disposition.

## What the fixture pair actually does

- `(C,3)` — a **C1**-family column nudged +300 units. Position is not identity: its key must
  survive unmoved.
- `(A,3)` — a **C1**-family column deleted. The C1 family goes 4 → 3 *with* a nudge in the same
  family: the exact 82.6%-phantom-money class `identity.md` §4 names. Ordinals frozen at first
  registration must not migrate onto surviving siblings.
- `C4` at (12000, 9000) — added, off-grid (beyond the 0.9 near-anchor bound). It registers in
  the honest off-grid form, never snapped.
- The title retitles `(R1)` → `(R2)` — a caption change that must not re-partition the view.

## Guardrails

- `identity.md` §4–§5 bind verbatim. The semantic is the invalidator, **never** the key.
- A removed member is a named disposition, never a silent absence — silence is the condemned
  state.
- The one-hop carry (`@unregistered:<label>` → `<levelId>`) exists exactly once; if ticket 07
  registered under `UNRESOLVED`, this ticket proves the hop moves filed dispositions.
- Over-measurement is a hard block: the delta may never produce a duplicate scope row.

## Exit criteria

- [x] **The map's destination test**: identical multiset of identity keys for unchanged members
      across the revision pair; changed members re-present; nothing orphans.
- [x] The nudged C1 keeps its ordinal; the deleted C1's ordinal is not reused by a sibling.
- [x] Every refusal and deferral in the whole pipeline carries a named reason, asserted.
- [x] `pnpm verify` green and under 60s; `pnpm test:db` green.

## Build note

`src/core/pairing.ts` is now the one site of the identity law: `familyIdentities` (unchanged
§4 derivation), `sightingSemantic` (§5's order-normalized canonical JSON, anchor read back out
of the placement key, handles sorted) and `pairRevision` — exact placement key, then nearest
unclaimed prior of the **same view** within a carry bound, then appended-or-fresh, then the
vacated. `register.ts`'s door consumes it and now returns `unchanged | represented | removed`
beside `registered | refused`. Migration 0010 puts `semantic` on `register_object_sightings`;
0011 re-keys its unique on `(project, drawing, ingest, placement)` because the app lane may
never UPDATE a sighting (0009) — a restated placement files new evidence and the old row stays
as history. Ticket 07's snapshot bookkeeping (0009 carried 0008's snapshot id) was repaired so
drizzle-kit could generate at all; no landed SQL was touched.

Live on the fixture pair: rev 2 registers nothing, refuses nothing — 2 unchanged, 6 re-presented
(the nudge plus five whose DXF handles the revision shifted, §5's exact clause), 1 removed by
name; C1#4 rides the +300 nudge, and the deleted C1#2 stays retired.

Ticket 09 should know two things the fixture does *not* do: the added **C4 places nothing** — no
view that may state types names it, so its class is unwitnessed and its absence is named
(`CLASS_NOT_WITNESSED`); and had it been witnessed it would read (C,3), not off-grid, at the
0.9 bound. Also unbuilt: the `@unregistered:<label>` → `<levelId>` hop, which has no filed
dispositions to move until a disposition surface exists — and an *addition inside a family that
this view has already sighted* takes the next free ordinal, while the same member sighted from a
second view still collides as `DUPLICATE_IDENTITY`; that split is what keeps the double-count
guard intact.
