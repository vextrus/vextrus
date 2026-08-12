# The revision delta — the destination test

wayfinder:task
Status: open
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

- [ ] **The map's destination test**: identical multiset of identity keys for unchanged members
      across the revision pair; changed members re-present; nothing orphans.
- [ ] The nudged C1 keeps its ordinal; the deleted C1's ordinal is not reused by a sibling.
- [ ] Every refusal and deferral in the whole pipeline carries a named reason, asserted.
- [ ] `pnpm verify` green and under 60s; `pnpm test:db` green.
