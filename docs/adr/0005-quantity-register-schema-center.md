# ADR-0005 — The Quantity Register is the schema center

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

The legacy repo retrofitted the register onto a 22-module ERP in month ten; the takeoff map
then spent 26 decision tickets deriving what the register must actually be — the quantity
contract (basis × coverage), the identity key, the act log, the scope register, fail-closed
scale, `kind = chapter × dimension`. Market research confirms the two properties this
architecture yields — revision-stable quantity identity and per-quantity trust declaration —
are unoccupied ground among all shipping competitors.

## Decision

- The spine (`src/core/` + `db/schema/core.ts`) owns: project record and facts, level stack
  (surrogate ids; label/ordinal/height non-identifying), drawings/revisions/ingest-fidelity,
  scale families and calibrations, the register (objects, attributes, quantity lines, refused
  sightings, scope rows), the append-only act log, and the closed quantity-kind enum.
- Element identity: `(project, discipline, level, element type, mark, ordinal)`; ordinal frozen
  at first registration; no coordinates, labels, or correctable attributes in any identity key
  or signature. A unique constraint makes the double-count guard structural; a second sighting
  is refused into a separate table with no join from any bill.
- The quantity contract binds from the first migration: basis per attribute with derived
  roll-ups; coverage never `PARTIAL_UNDECLARED`; provenance as references, never prose;
  `calibration_id NOT NULL`; over-measurement is a hard block; no grand total under incomplete
  coverage; the Certificate of Measured Coverage is a query over book × scope register.
- The full law is documented in `docs/domain/` (quantity contract, identity, measurement rules,
  BD authority, formulas, CAD ingestion) — re-derived from the legacy decision corpus, cited by
  tickets, implemented by code.

## Consequences

- Everything downstream (pricing, estimates, bids, and any future module) derives from register
  rows; "no module may originate a quantity" is checkable at the schema.
- The register is deliberately demanding — refusal and deferral are first-class states — which
  is the product thesis, not overhead.
- Rules that a human may author are data (versioned, cited, forked never mutated); methods stay
  code enumerated by (rule id, version). Swapping a threshold changes output with no code edit.
