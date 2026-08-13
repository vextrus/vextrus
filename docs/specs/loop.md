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

Preflight (all mechanical, all refuse loudly): `pnpm checkup` exit 0 **first** — a campaign
assumes a known start state and a cloud container has two (ticket 12), so the machine is
cleared before the tree is, and a snapshot-restored one refuses in ~1.3s naming
`scripts/provision.sh` instead of burning a full verify to say something true and unhelpful;
this subsumes the :3210 check (a dev server is a second writer). Then: no concurrent run
(`.loop/ACTIVE`), clean tree, baseline `pnpm verify` green — checkup asks whether the machine
is fit, verify whether the tree is green, and a campaign needs both — pre-push guard armed
(`.githooks/pre-push` refuses every push while a campaign is active).

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

## The campaign's unit is the arc (ADR-0010)

Everywhere else, the dispatcher picks the ticket and writes the claim (`.wayfinder/TRACKER.md`).
The loop cannot work that way — `frontier.mjs` selects and the worker sets and clears its own
claim, which gate C2 then checks. That is legal here because the loop's **dispatch unit is the
arc directory, not the ticket**: you dispatch a campaign against `.wayfinder/<effort>/arcs/<arc>/`
and that directory is exclusively the campaign's until it ends. Nobody else touches those tickets
meanwhile. Self-selection inside a boundary no one else is inside collides with nothing.

Everything else is identical: the branch is dispatcher-created, the pre-push guard mechanically
withholds every push until the campaign ends, and the work lands through the same
fetch-merge-`verify`-push-evidence-click.

One consequence to plan around rather than be surprised by: a campaign is a long-lived branch
that *cannot* push, so `main` may move far underneath it. The end-of-campaign merge is therefore
the riskiest merge in the system — the one most likely to be genuinely red. Short campaigns, and
no other work landed during one.

## The context line — 150,000 tokens, and what records it

`.wayfinder/TRACKER.md` already states the number for interactive sessions ("Past 150K mid-ticket:
write state into the ticket, `/clear`, resume fresh"), and the loop uses that one rather than
minting a second: a harness with two context lines has none.

Every iteration logs `ctxPeak`, `ctxWindow`, `ctxCalls` and `overContextLine`
(`scripts/loop/usage.mjs`). `node scripts/loop/flags.mjs [.loop/<run>]` renders the pile the
boundary review substitutes into `REVIEW.md`'s `{FLAGS}`.

**This did not exist before 2026-08-13.** The section below has always called the flag pile the
review's mandatory first read, and nothing computed it — the placeholder rendered as a blank
space, which cannot distinguish "no session crossed" from "nobody measured". The three sessions in
`.loop/2026-08-12T05-24-16` are permanently in the second category and the pile now says so
instead of reporting them clean.

The peak comes from the worker's message stream, not from its result object: the result's `usage`
is **cumulative across the session** and its `iterations` array is **partial**, so neither is a
context size (`docs/TRAPS.md`, and `usage.mjs`'s header carries the measurement). That is why the
worker runs under `--output-format stream-json --verbose`.

**The line is provisional in the way `MAX_TURNS` is provisional**: nothing here has ever connected
context to output quality, so 150,000 is a threshold inherited from a working rule, not a measured
cliff. `.wayfinder/harness/inbox/what-fills-a-cloud-session.md` §3 either establishes that
relationship or rules that it cannot be established — and this instrumentation is what gives it
data to work from.

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
