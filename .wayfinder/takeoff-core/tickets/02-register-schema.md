# The register schema

wayfinder:task
Status: open
Blocked by:

## Objective

The spine's first real tables (`db/schema/core.ts` + migration): `projects` (pins per
`docs/domain/identity.md` §8), `levels` (surrogate id; label/ordinal/height non-identifying),
`drawings` + `drawing_revisions`, `ingests` (artifact ref + fidelity counters),
`register_objects` with the identity key and its unique constraint, `refused_sightings`
(separate table, no bill join), `acts` (append-only). Skeleton-grade CRUD in `src/core/`
behind typed functions.

## Guardrails

- The identity key is `(project, discipline, level, element type, mark, ordinal)` — no
  coordinate, label, or correctable attribute in any key or unique constraint
  (`docs/domain/identity.md` §2). The unique constraint IS the double-count guard.
- Every tenant table: `tenant_id` + the `db/rls.ts` block in its migration + seam-only access.
- Domain enums (discipline, element type, act types) are TS consts in `src/core/enums.ts`
  with CHECK constraints derived from the same const (ADR-0002).
- Act row + state change in one transaction, enforced at the seam (`identity.md` §7).
- No quantity lines yet — objects and acts first; lines come with fan-out.

## Exit criteria

- [ ] Migration applies clean on a fresh DB; `pnpm db:drift` clean.
- [ ] dbspec: duplicate identity insert refused by the constraint; refused sighting lands in
      its own table; an act and its state change roll back together.
- [ ] `pnpm verify` green.
