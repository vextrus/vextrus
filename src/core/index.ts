/**
 * The spine. Owns the Quantity Register and everything identity-bearing:
 * project record and facts, level stack, drawings/revisions/ingest fidelity,
 * scale families, register objects and quantity lines, the act log, the closed
 * quantity-kind enum, and the tenant seam (ADR-0004, ADR-0005).
 *
 * Core may never import from src/modules — the dependency points inward only.
 */
export {};
