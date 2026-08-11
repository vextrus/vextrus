# ADR-0007 — The verification contract and the thin harness

**Date:** 2026-08-12 · **Status:** accepted (founding)

## Context

The legacy harness reset measured all of this the hard way: attention degrades past ~150K
tokens; a 48K startup context produced worse work than a 13K one; in-session hooks generated
544 error events and a median 49s commit latency; nine custom agents amplified over-delegation;
slow or cache-poisoned verification made sessions dishonest. Verification latency is the
dominant quality lever ("an 8-second suite makes a careful collaborator; a 12-minute one makes
a confident guesser"), and green exit codes alone are gameable — the counter is an independent
review pass and mechanical "never weaken a check" enforcement, not more prompt text.

## Decision

- **One command:** `pnpm verify` = `tsc --noEmit` → eslint → vitest → cad (ruff + pytest),
  fail-fast, no caching anywhere. Target <60s at founding, <90s at scale — slower is a defect.
  Its exit code is the whole contract. Playwright e2e lives outside the lane (on demand + CI).
- **Boundaries fail closed:** ESLint import rules keep modules behind their `index.ts`; a
  fixture violation test asserts the rule actually fires.
- **Thin harness:** CLAUDE.md ≤6,000 chars holding only non-derivable, damage-preventing
  content; `docs/CONTEXT.md` and `docs/TRAPS.md` read on demand; ADRs never edited, only
  superseded. Zero custom agents, zero hooks at founding — anything restored must earn its
  place with a measurement, one thing at a time.
- **Work decomposition:** `.wayfinder/<effort>/` local-markdown maps and tickets; one ticket
  per session, `/clear` at the boundary, never `/compact`; a ticket too big for one session is
  a graph defect — split the node, never stretch the session.
- **Review is separate from generation:** the diff gets a fresh-context review pass; tests are
  never deleted, renamed, or weakened to pass — enforced in review mechanically, not by prompt.

## Consequences

- The repo is the harness: quality comes from the environment (boundaries, fast verify, seam
  tests), and the standing context stays under ~2K tokens of harness-controlled content.
- We deliberately give up hook-based gates, fan-out workflows, and rich session memory — the
  legacy measured each as net-negative. The map on disk replaces memory; sequential depth
  replaces parallel breadth.
- Every foundation phase ends with a measurement written back into the spec; an unmeasured
  phase is not done.
