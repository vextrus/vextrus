# The register schema

wayfinder:task
Status: closed
Blocked by:
Claimed by:

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

- [x] Migration applies clean on a fresh DB; `pnpm db:drift` clean.
- [x] dbspec: duplicate identity insert refused by the constraint; refused sighting lands in
      its own table; an act and its state change roll back together.
- [x] `pnpm verify` green.

## Resolution

Landed as migrations `0004_register-spine.sql` (tables) + `0005_register-rls.sql` (RLS blocks),
schema in `db/schema/core.ts`, enums in `src/core/enums.ts`, seam CRUD in `src/core/register.ts`
+ `src/core/acts.ts`, proven by `db/__tests__/register.dbspec.ts`. Shape decisions worth
remembering:

- **The identity unique constraint is `UNIQUE NULLS NOT DISTINCT`** over (project, discipline,
  level_id, level_basis, element type, mark, ordinal). The level slot is two columns —
  `level_id` (surrogate) + `level_basis` (`LEVEL`/`FOUNDATION`/`UNRESOLVED`, identity.md §3) with
  a CHECK tying them — because a plain UNIQUE treats NULL level as always-distinct and would
  silently admit duplicate foundation-class identities. The dbspec proves the level-null
  duplicate refuses.
- **`tie/grade beam` is one enum value** (`tie_grade_beam`): two values for one physical class
  would let one member register twice past the double-count guard.
- **Append-only acts is a grant, not a convention**: the RLS migration gives `vextrus_app`
  SELECT+INSERT only on `acts`; UPDATE/DELETE are permission-denied on every request path
  (dbspec-proven). Act+state atomicity is `withAct(ctx, act, fn)` — one `forTenant` transaction,
  subjects derivable from the state change's result.
- **Ingest honesty is CHECK-enforced**: `succeeded` requires artifact ref + full fidelity
  counters (mirroring the EntityGraph counters block verbatim); `failed` requires a named error;
  the seam additionally refuses empty error strings.
- **Project pins** (identity.md §8) are three nullable opaque text columns
  (`pinned_book_edition`/`pinned_rule_set`/`pinned_multiplier_scheme`) — NULL = not pinned,
  campaign creation (out of this map) refuses on it; no default edition exists.
- Refusal causes are one shared taxonomy (`refusalCauses`, identity.md §7 + quantity-contract
  §2): door causes (DUPLICATE_IDENTITY, DISCIPLINE_NOT_AUTHORITATIVE) + scope causes.
- Alternative put and rejected: a status/cause column on `register_objects` (identity.md §2's
  disqualified design) — the dbspec asserts the register carries no such column.

Code review (confirmed findings, all fixed structurally before landing):

- **FK validation bypasses RLS** — live-verified: tenant A could attach a revision to tenant
  B's drawing and squat its `(drawing_id, seq)` slots. Every parent reference is now a
  composite FK carrying `tenant_id` against a `(id, tenant_id)` pair-unique on the parent.
- **The levelId hole** — a register object could cite a sibling *project's* level, corrupting
  the identity key. `(level_id, project_id)` → `levels(id, project_id)`; same shape for
  `refused_sightings.register_object_id`.
- **Frozen identity was convention** — the app lane held UPDATE/DELETE on `register_objects`.
  Now SELECT+INSERT only (like `acts`, like `refused_sightings`); enrichment columns widen by
  column-scoped GRANT in their own migration.
- **Actor membership** — `withAct` refuses an actor who is not a member of the ctx tenant
  (an FK onto memberships was rejected: it would block offboarding a user who ever acted).
- Residue: a retried ingest clears `error` on success (CHECK also refuses the residue) and
  artifact/counter fields on failure. 25P02 savepoint note documented on
  `insertRegisterObject` for ticket 05's door.

Fresh-DB proof: full 6-migration history applied clean on a scratch database; `pnpm db:drift`
clean; `pnpm verify` green in 4.9s; `pnpm test:db` 22 passing.
