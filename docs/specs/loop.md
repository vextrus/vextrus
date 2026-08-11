# The loop — autonomous ticket execution

**Status:** landed at founding (ADR-0008); caps provisional until the first measured campaign.

The wayfinder workflow produces build tickets (`/to-spec` → `/to-tickets` →
`.wayfinder/<effort>/arcs/<arc>/`). The loop executes them headless, one fresh session per
ticket, with deterministic conductor-side gates between iterations. **The loop executes
decided work; it never decides** — when a worker meets an undecided question it stops and
surfaces it, and splitting an oversized ticket stays human graph-work.

## Design law (inherited from the legacy campaign, measured there)

- **Autonomy comes from gates, not trust.** A session's claim of "done" counts for nothing;
  the conductor independently re-verifies. Doer ≠ judge, revived *outside* the context window
  where it costs zero tokens — a gate the worker can observe is a gate it can negotiate with.
- **All state on disk.** A reboot resumes at the frontier; a morning review reads evidence —
  log, diff, ticket notes — never transcripts.
- **Quality binds, budget does not.** Turn caps are derived from measured honest-close p95
  (~2×), wall clock is a runaway fuse; cost is logged, never a gate.
- **A ticket too big for one session is a graph defect** — split the node, never stretch the
  session.

## Usage

```
node scripts/loop/conduct.mjs .wayfinder/<effort>/arcs/<arc> [--arc <name>] [--max-tickets N] [--dry-run]
```

Preflight (all mechanical, all refuse loudly): no concurrent run (`.loop/ACTIVE`), clean tree,
nothing answering on :3100 (a dev server is a second writer), baseline `pnpm verify` green,
pre-push guard armed (`.githooks/pre-push` refuses every push while a campaign is active).

Per iteration: `frontier.mjs` picks the next ticket (open + unclaimed + blockers closed,
fail-closed) → a worker session runs `scripts/loop/PROMPT.md` against it → the conductor
gates:

| gate | checks |
|---|---|
| C1 | independent `pnpm verify` re-run, fresh, uncached |
| C2 | ticket `Status: closed`, zero unticked acceptance boxes, claim cleared |
| C3 | clean tree; HEAD moved; the closing commit cites the ticket file |
| C4 | no test file deleted or renamed across the ticket's diff |

Pass → advance to the next frontier ticket. Fail, `## Stuck`, or `## Handoff` → **halt with
evidence** (`.loop/<run>/HALT.md`); the tree stays exactly as the worker left it. No silent
retries, no conductor cleanup — evidence first.

## The boundary review

After an arc completes, run one judge session with `scripts/loop/REVIEW.md` (arc name, start
sha, and the flag pile substituted): four charters — correctness, standing invariants, test
adequacy, client-surface honesty — filing `9N-fix-*` tickets rather than fixing, write
surface `.wayfinder/` only. Sessions that crossed the context line are its mandatory first
read: in the legacy campaign, exactly those sessions hid two quiet quantity-corruption
defects.

## Provisional numbers — re-derive, don't trust

`MAX_TURNS = 150` and the 30-minute wall fuse are carried from legacy measurements of a
*heavier* environment (their verify was ~100s; ours is ~4s). After the first campaign of
~10+ honest closes, derive the real caps from `.loop/*/log.jsonl` (p95 × 2) and update
`conduct.mjs` and this spec with the measured numbers. An unmeasured cap is a guess wearing
a constant's clothes.

## What is deliberately absent

Automatic retries (a retry over an un-diagnosed halt destroys evidence), parallel workers
(one writable checkout per branch, ever), context-size gates (worker transcripts are not
parsed in v1 — the boundary review reads flagged diffs instead once turn counts are logged),
and any conductor-side "fix-up" of worker output (the conductor is a judge, not a second
doer).
