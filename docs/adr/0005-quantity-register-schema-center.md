# ADR-0005 — The Quantity Register is the schema center

**Date:** 2026-08-16 · **Status:** accepted (second founding; re-derives the 2026-08-12 decision)

## Context

The legacy retrofitted a register onto a 22-module ERP in month ten; 26 decision tickets then
derived what it must be. That derivation is `docs/domain/` — six files, carried verbatim into
this founding as the only artifact worth more than it cost. Market research re-run in August 2026
(`docs/research/market-2026-08.md`) confirms the two properties the register yields — a
domain-derived identity that survives a re-issued drawing, and a per-quantity basis and coverage
declaration — are still unoccupied by any shipping product.

## Decision

- **The spine** (`src/core/` + `db/schema/core.ts`) owns: tenants and projects (pins as a
  precondition of campaign creation), the level stack (surrogate ids; label, ordinal and height
  non-identifying), drawings / drawing-set revisions / ingest fidelity, scale families and
  calibrations, the register (objects, attributes with basis, quantity lines, refused sightings
  in a separate table with no join from any bill), the append-only human-only act log, the model
  call ledger (ADR-0006), and the closed quantity-kind enum. **The four modules enrich the spine;
  no module may originate a quantity.**
- **Element identity** is `(project, discipline, level, element type, mark, ordinal)`; ordinal
  frozen at first registration; no coordinates, labels or correctable attributes in any identity
  key or signature. A unique constraint makes the double-count guard structural.
- **The quantity contract binds from the first register migration**: basis per attribute with
  derived roll-ups; coverage never `PARTIAL_UNDECLARED`; provenance as references never prose;
  `calibration_id NOT NULL`; over-measurement is a hard block; no grand total under incomplete
  coverage; the Certificate of Measured Coverage is a query, never prose.
- **Rules a human may author are data** (versioned, clause-cited, forked never mutated); methods
  are code enumerated by (rule id, version) with CI asserting a content hash. Locality — rate
  books, tax rules, zone maps, measurement thresholds — is effective-dated data, never code
  (`docs/domain/bd-authority.md`, `measurement-rules.md`); nothing rate- or tax-shaped is a constant.
- **`docs/domain/` is the law; code implements it; specs and issues cite it.** The register lands
  in the first takeoff ticket, citing `identity.md`; the skeleton carries tenancy and the project
  record only.

## Consequences

- Everything downstream derives from register rows; "no module may originate a quantity" is
  checkable at the schema.
- The register is deliberately demanding — refusal and deferral are first-class states — which
  is the product thesis, not overhead.
- Going global is adding datasets and document conventions over the same register, not forking code.
