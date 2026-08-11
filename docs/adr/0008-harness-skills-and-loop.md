# ADR-0008 — Harness extension: the skill family and the loop conductor

**Date:** 2026-08-12 · **Status:** accepted

## Context

The founding harness (ADR-0007) shipped thin: CLAUDE.md, on-demand docs, the wayfinder
tracker — but no skills and no execution loop. The legacy repo proved both over a real
campaign: the wayfinder skill family (adapted from mattpocock/skills) carried a 26-ticket
decision map to closure, and the loop conductor executed five arcs of build tickets headless
with deterministic gates. CLAUDE.md already told sessions to use `/wayfinder`; the skill had
to actually exist here.

## Decision

- **Nine skills ported into `.claude/skills/`**, adapted to this repo (local-markdown tracker,
  `docs/specs/` + `docs/research/` conventions, `pnpm verify` with no scope flag, `docs/domain/`
  citations): `wayfinder`, `grilling`, `research`, `prototype`, `to-spec`, `to-tickets`,
  `implement`, `tdd`, `handoff`. The heavy planning skills carry
  `disable-model-invocation: true` — user-invoked only, near-zero listing cost.
- **Two skills deliberately not ported:** `teach` (no learning-workflow need here) and
  `triage` (an inbound-issue state machine for a repo with no inbound request surface).
  Either returns when a named need appears — one thing at a time, measured.
- **The loop conductor is built now, lean** (`scripts/loop/`: `conduct.mjs`, `frontier.mjs`,
  `PROMPT.md`, `REVIEW.md`; spec at `docs/specs/loop.md`): the legacy gate design is proven
  and portable, and this environment makes it far simpler — full verify is ~4s, there is no
  DDL side-lane, no codegen step, no dev-server schema writer. Node, not bash (the legacy's
  own trap: PowerShell's `bash` is WSL). Safety is mechanical, not instructional: a
  committed pre-push guard (`.githooks/pre-push`) refuses every push while a campaign is
  active; preflight refuses a dirty tree, a live dev server, a red baseline.
- **Caps are provisional and say so.** Turn cap and wall fuse are carried from legacy
  measurements and marked for re-derivation from this repo's own first campaign log
  (p95 × 2). Deriving caps from measurement, never hunches, is itself the inherited rule.

## Consequences

- The full path — loose idea → `/wayfinder` map → `/to-spec` → `/to-tickets` → conductor →
  boundary review — exists on day one, so the first module arcs can run autonomously the
  moment their tickets are decided.
- The harness stays thin where it counts: zero hooks in the session path, zero custom
  agents, planning skills invisible to the model until invoked. The one hook added
  (pre-push) runs in git, not in the session, and costs no context.
- v1 omissions are recorded in the spec (no auto-retry, no parallel workers, no transcript
  parsing) — each returns only with a measured need.
