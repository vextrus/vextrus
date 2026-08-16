# ADR-0007 — Verification: one command, seconds, no cache that can lie

**Date:** 2026-08-16 · **Status:** accepted (second founding; re-derives the 2026-08-12 decision)

## Context

Verification latency is the dominant quality lever for agent-built code, and green exit codes
from cached or partial runs are how sessions become dishonest. The first founding measured
`pnpm verify` at 4.0 s and it stayed under 16 s with a build stage; the discipline held. What
the four days between foundings added was not a better contract but a harness around it — nine
ADRs of workflow — and that is out of scope here by rule: **an ADR records a decision that
constrains product code.** How sessions are dispatched, claimed or merged belongs in
`docs/tracker.md` or nowhere.

## Decision

- **One command:** `pnpm verify` = `tsc --noEmit` → `eslint .` → `vitest run` → `ruff check`
  → `pytest`, fail-fast, uncached, its exit code the whole contract. Only its output is evidence.
  Measured at this founding: **3.9 s** (typecheck 1.5 · lint 0.9 · test 1.0 · ruff 0.0 · pytest 0.4)
  on WSL2 Ubuntu 24.04, Node v24.19.0, pnpm 9.15.1, uv 0.12.5 / CPython 3.13. Target stays
  <60 s; slower is a defect to fix, never a reason to cache.
- **Stack-dependent stages stay out.** `pnpm test:db` (live Postgres seam test) runs on demand;
  a daemon inside verify makes green depend on the machine. `next build` is likewise outside at
  founding — the shell has no route worth prerendering; it joins the lane, cold and into its own
  `distDir`, the day a route can throw during static generation.
- **Guardrails fail closed.** Every ESLint rule that enforces a NEVER (module boundaries, the two
  seams, the comparator, number formatting) has a fixture test asserting it fires.
- **`pnpm checkup` is the machine's report, not a verify stage**: node/pnpm pins, `NODE_ENV`
  unset, uv, `.env`, Postgres reachable, app role, migration drift, port bindable. It runs once at
  `SessionStart` (~400 tokens) because it is the only thing that reports an unfit machine before
  work starts.
- **Never weaken a check.** Tests are never deleted, renamed or edited to green a build; fixtures
  are re-earned, not re-pinned. Enforced in review of the diff, mechanically where possible.

## Consequences

- The repo is the harness: quality comes from boundaries, fast verify and seam tests, not from
  prompt text.
- Verify's wall time is recorded in `docs/specs/genesis-ii.md` with the machine; a phase without
  a measurement is not done.
- What is deliberately given up: workflow machinery in the repo. Tickets, claims, state and
  priority live in GitHub Issues (`docs/tracker.md`); versioned and immutable things — domain
  law, ADRs, specs, lessons — live in git.
