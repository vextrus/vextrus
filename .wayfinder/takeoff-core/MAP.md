# Map — The takeoff core

## Destination

**A synthetic structural drawing measures into Quantity Register rows whose identity survives
a drawing revision.** Upload a DXF → ingest (fidelity counters real) → views/grid → register
objects with the identity key → re-upload a revised DXF → the register reports a *delta*, not
a do-over. That is the product's deepest moat (genesis §1) proven as a tracer bullet, before
any pricing.

Done when: the revision-pair fixture round-trips with stable identities, every refusal carries
a named reason, and `pnpm verify` stays under 60s.

## Notes

- The domain law binds: `docs/domain/identity.md` (the key, ordinal freeze, pairing),
  `docs/domain/cad-ingestion.md` (extractor invariant, view law, grid backbone),
  `docs/domain/quantity-contract.md` (refusal shapes). Tickets cite clauses, not vibes.
- Fixtures are **synthetic** — drawn for this repo, including the revision pair. Competitor
  data never enters (CLAUDE.md guardrail).
- Schema changes ride `pnpm db:generate` → migration → `pnpm db:migrate`; every tenant table
  gets the `db/rls.ts` block in its migration (ADR-0004).
- One ticket per session; `/clear` at the boundary (`.wayfinder/TRACKER.md`).

## Decisions so far

*(appended one line per closed ticket)*

- 01 — better-auth's org plugin maps onto `tenants`/`memberships` (one model, B2C = single-member
  tenant); auth runs as a third constrained role `vextrus_auth`, never owner; signup's deferred
  after-hook is healed once in the tRPC auth middleware; verify 4.6s.
- [02 — The register schema](tickets/02-register-schema.md) — spine tables landed (0004/0005);
  identity is `UNIQUE NULLS NOT DISTINCT` with a two-column level slot (id + basis) so
  foundation-class duplicates refuse; composite FKs close the FK-bypasses-RLS hole (review-caught
  live); register/acts/refusals frozen or append-only by grant; seam CRUD in
  `src/core/register.ts`; verify 4.9s, test:db 22.
- [03 — DXF to EntityGraph](tickets/03-dxf-to-entitygraph.md) — `ingest` CLI lands: closed
  10-type entity vocabulary, `src is None` as the original predicate, per-type loss AND
  `unsupported_by_type` counters (counted, never dropped); synthetic revision-pair fixtures
  regenerate byte-identically (pinned hash seed + `.gitattributes` `-text` guard the sha256
  pin); sanity number 34/48/{POINT: 4}; review caught mesh-variant crash, decimation leaking
  into area, and four validator-drift edges — all fixed in-ticket; db-side counter column +
  register guards routed to ticket 04; verify 7.0s.
- [04 — Drawing upload and the ingest job](tickets/04-upload-and-ingest-job.md) — the queue is a
  plain `ingest_jobs` table claimed with `FOR UPDATE SKIP LOCKED` (ADR-0009: pg-boss would be a
  second migration lane, and enqueue must commit with the revision it describes); the app lane
  enqueues and reads, only the worker's system lane moves a job. Upload → revision + ingest +
  job in one transaction → `src/server/worker.ts` runs the cad CLI as a subprocess → artifact on
  disk, counters (unsupported_by_type included) on the ingest row, truncations surfaced as
  warnings on the drawing's status. Ticket 03's three routed findings closed: the counter column,
  a `<> 'succeeded'` predicate making a succeeded ingest terminal, and evidence citation
  project-paired by FK (project_id now carried down the revision chain). Review caught a timeout
  that could still hang (the grandchild python holds the pipe), a one-to-many status join, and a
  claim failure that killed the worker — all fixed in-ticket. verify 6.3s, test:db 33.

- [05 — The view partition](tickets/05-view-partition.md) — the fixture was extended to a
  four-view **sheet** (plan + schedule + member-scoped detail + an unclassifiable caption +
  stray junk), re-pinning the sanity number to 59/49/`{POINT: 4}` with both revisions'
  artifacts committed; six python assertions tightened, none weakened. `mayYieldInstances`
  admits `layout_plan` alone (narrower than legacy's stair-plan analogue — a stair plan repeats
  members the floor plan places), proven the single decision site by a scan that is itself
  tested. The partition is coverage-band with the gap keyed to **caption** height, not body text
  (keyed to body text a schedule shatters into columns); measured stability window 5–16.5, default
  12; the caption-reach fold was deleted once it became unreachable. The asserted safety property:
  across a 10× tuning sweep the layout plan never *gains* an entity — mistuning under-measures and
  says so. verify 8.2s.

- **05 split (graph defect, not a decision).** "Views, grid, and first identities" bundled four
  session-sized units — view partition, grid backbone, placement + the register door, the
  revision delta — each comparable to ticket 04, which alone took a migration and a subprocess
  seam. Ticket 02's own header already deferred "the door, pairing, ordinals" into it. Split into
  [05 view partition](tickets/05-view-partition.md) → [06 grid](tickets/06-grid-backbone.md) →
  [07 placement and first identities](tickets/07-placement-and-first-identities.md) →
  [08 the revision delta](tickets/08-the-revision-delta.md), chained. Two decisions surfaced by
  reading the fixtures against the domain law and written into the tickets that must rule them:
  the fixture set carries **one** view, so §7's may-yield-instances predicate would be asserted
  against nothing (05); and a grid bubble's circle is **derived paint** in every fixture — only
  the INSERT and its attributes are original — so §8's content signature collides with §3's
  extractor invariant (06).

## Not yet specified

- Scale-family affirmation UX (fail-closed per region). 05 showed this stage needs no affirmed
  scale at all — the partition reads only ratios of the drawing's own text heights — so the
  question belongs to measurement, not to ingestion. Chart it when a quantity needs a length.
- Quantity fan-out and the pricing seam — a separate effort once the register holds objects.
- Object storage for artifacts (the filesystem root is ticket 04's stated interim) — a named
  need once a second process needs the tree.

## Out of scope

- **Pricing, the book module, estimates, bids** — this map ends at register rows.
- **DWG conversion** (LibreDWG lane) — DXF fixtures first; the converter is config, not logic.
- **Auth UX polish** — ticket 01 lands the mechanism, not the design system.
