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

## Not yet specified

- Scale-family affirmation UX (fail-closed per region) — chart after 05 lands.
- Quantity fan-out and the pricing seam — a separate effort once the register holds objects.
- Job queue shape (plain SKIP LOCKED vs pg-boss) — decided inside ticket 04, recorded here.

## Out of scope

- **Pricing, the book module, estimates, bids** — this map ends at register rows.
- **DWG conversion** (LibreDWG lane) — DXF fixtures first; the converter is config, not logic.
- **Auth UX polish** — ticket 01 lands the mechanism, not the design system.
