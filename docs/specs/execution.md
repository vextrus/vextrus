# Continuous execution — one conductor, one worker per ticket, one PR per ticket

**Status:** spec only — nothing here is built, per the dispatcher's ruling. Written 2026-08-13
on `win32 x64 · node v24.12.0`, branch `claude/harness-grounding`, against the winner named in
`docs/research/the-dispatch-primitive.md`: **a persistent Linux host the dispatcher owns,
running today's loop with headless `claude -p` workers**, with the Routine API as a second
worker transport when the dispatcher mints a token.

Successor-in-part to `docs/specs/loop.md` (the per-iteration mechanics stand) and to
`docs/specs/cloud-campaign.md` §6 (the gate/quarantine shape stands; the dispatch seam is now
answered). It **extends `scripts/loop/conduct.mjs`** — same file, same gates, a second mode —
because the second orchestration vocabulary is the harness bloat this project is built against
(dispatcher ruling, 2026-08-13).

## The shape

```
conductor — conduct.mjs --per-ticket, on the dispatcher's Linux host (WSL2 or VPS)
  preflight: checkup fit · bwrap · gh auth · claude auth · clean tree · baseline verify green
  loop:
    frontier.mjs picks the ticket (open + unclaimed + blockers closed, fail-closed)
    claim  — `Claimed by: conductor <run-id>` committed to main by CAS      [checkpoint 1]
    branch — conductor creates claude/<ticket-slug> from origin/main
    work   — one fresh worker session on that branch (PROMPT.md; spawn per item-5 rules)
    gates  — C1 verify · C2 ticket · C3 tree · C4 tests   (verbatim from conduct.mjs)
    review — one fresh judge session (REVIEW.md charters, scoped to this diff): may only refuse
    push   — conductor pushes the branch through the named door             [checkpoint 2]
    PR     — gh pr create; evidence row in the body                        [checkpoint 3]
    reland — pnpm reland brings every open PR forward after any merge
    on failure: quarantine the ticket, continue the campaign
  fuses: all numbers, all below
merge — never the conductor, never the author: the dispatcher's click on a green parity
```

## Rulings

### One worker per ticket, one PR per ticket

Each frontier ticket gets a fresh session on a fresh dispatcher-created branch, and lands as its
own PR. The end-of-campaign mega-merge — `loop.md`'s own "riskiest merge in the system" — is
deleted, which is what the first parallel wave already proved safe (nine small merges, §1 of
`cloud-campaign.md`). The loop's arc-directory exemption (self-selection inside an owned
directory) is retired exactly as ADR-0010 amendment #2 scheduled: the conductor claims by CAS on
`main`, so the dispatch unit is the ticket again.

**Claims are the first checkpoint and live on `main`.** The conductor writes `Claimed by:
conductor <run-id>` through the GitHub contents API with the blob sha as precondition —
compare-and-swap, atomic under concurrent dispatchers, using the `gh` credential that already
lives on the host (no new secret; the no-secret ruling binds workflows, not the dispatcher's own
machine). A conductor that dies after the claim leaves a visibly claimed ticket, which
`frontier.mjs` already refuses to re-pick — recovery is reading `main`, not local state.

### The reviewer can refuse; it cannot approve

Gate G4 is one fresh judge session per PR: `REVIEW.md`'s four charters (correctness, standing
invariants, test adequacy, client-surface honesty), scope pinned to this ticket's diff, write
surface `.wayfinder/` only, `9N-fix-*` tickets filed rather than fixes made. Its verdict has one
active value: **refuse**, which quarantines the ticket and posts the findings to the PR (the
conductor posts them; the judge session holds no GitHub surface). A pass does nothing at all —
the PR still waits on `parity` and the dispatcher's click. There is no approval state anywhere in
the system: an AI that can unblock a merge is trust wearing a gate's clothes
(`cloud-campaign.md` §6), and a reviewer whose "yes" is inert cannot be negotiated with.

### Quarantine, not halt-the-world — and the claim is the quarantine

A ticket that fails a gate, goes `## Stuck`, or times out keeps its claim. That is the whole
mechanism: `frontier.mjs` already skips claimed tickets, so a quarantined ticket cannot be
re-picked by this or any later run until a human clears the claim — no new state, no second
writer, no edit to the worker's evidence. The conductor pushes the branch as it stands and opens
a **draft** PR titled `QUARANTINED: <ticket>` so the evidence outlives the machine and cannot be
merged by reflex. The campaign advances to the next frontier ticket.

### Checkpoints that survive the machine

Every load-bearing state transition lands somewhere durable before the conductor proceeds: the
claim (on `main`), the branch and PR (on GitHub), the evidence row (in the PR body and in the
committed run log — `the-loop-log-does-not-survive-the-container.md` is closed by item 6's
commit: `.wayfinder/<effort>/log/<run-id>.jsonl`, one file per run, conductor-written). A
conductor process killed at any point resumes by reading `main` + open PRs; `.loop/` remains
per-machine scratch.

### Fuses — every one a number

| fuse | value | source |
|---|---|---|
| worker turns | `MAX_TURNS = 150` | stands; n=1 cloud observation is 118 (1.27×) — re-derive at n ≥ 10 rows |
| worker wall | **30 min local / 60 min container** | 60 is `cloud-campaign.md`'s raise, now backed by 20.7 min measured and 44 s verify (#33 §8) |
| judge turns / wall | 60 turns / 20 min | a judge reads one diff; half a worker is generous until measured |
| consecutive quarantines | **3** → halt campaign | `cloud-campaign.md` §6 |
| quarantine rate | **> 40 % after ≥ 5 tickets** → halt | `cloud-campaign.md` §6 |
| tickets per run | `--max-tickets`, default 50 | existing |
| dispatch width | **1** on the local host (one writable checkout per branch, ever); **3** to start for Routine-API workers | `CLAUDE.md`; width has no data behind it |
| Routine API 429 | sleep `Retry-After`; **3 consecutive** 429s → halt dispatch, keep gating open PRs | the platform's own fuse, obeyed not reinvented |
| cost | logged, never a gate | ADR-0008 law, unchanged; `--max-budget-usd` exists and is deliberately unused |

### The pre-push guard gets a named door, not a carve-out

`.githooks/pre-push` rule 1 refuses every push while `.loop/ACTIVE` exists — correct for the v1
sequential campaign, wrong for a conductor that must push a gated branch per ticket. The door
follows the guard's own precedent (`VEXTRUS_ALLOW_MAIN_PUSH`): the conductor sets
`VEXTRUS_LOOP_PUSH=1` **only on its own push invocation's environment**, after gates pass.
Workers inherit the conductor's environment *without* it and remain unable to push. The `main`
refusal and the ticket-mint guard are untouched.

### Two worker transports, one conductor

The spawn seam is one function: `dispatch(ticket, branch) → evidence`. Transport A is today's
`claude -p` (stream-json parsed by `usage.mjs` — the only transport with `ctxPeak`). Transport B,
when the dispatcher mints a routine token, is `POST …/fire` with the ticket path, branch and
claim id in `text`; evidence is then the PR alone, and the row records `ctxPeak: null`
("unmeasured is not under the line"). Gates, quarantine, fuses and checkpoints are identical —
they never see the transport. A `400` on the beta header halts transport B by name and says the
platform moved.

## Rejected alternatives, named

- **A GitHub-Actions conductor holding an Anthropic secret** — ruled out by the dispatcher (no
  key funded); also runs on GitHub's compute, so it answers a question nobody asked.
- **The in-container conductor** — ruled out on credential lifetime (#33 §7); unchanged.
- **An orchestration framework** — dispatcher ruling; conduct.mjs's deterministic gates are the
  vocabulary, and this spec adds a mode, not a language.
- **A reviewer that can approve** — see above; refuse-only is the whole point.
- **Marking quarantine by editing the ticket** (`Status: halted`) — a conductor writing into a
  worker's evidence is a second doer; the standing claim already quarantines without touching it.
- **Automatic retries** — a retry over an un-diagnosed halt destroys evidence (ADR-0008 law).
- **Tracking `.loop/`** — the guardrail in `the-loop-log-does-not-survive-the-container.md`
  stands; durability is the committed per-run log file, not the scratch directory.
- **A merge queue** — still refused by GitHub for user-owned repos (`cloud-campaign.md` §5.3);
  the dispatcher's click plus `pnpm reland` remains the landing path.

## What must be true before this runs unattended

Item 3's denies and CLAUDE.md wording (a session that cannot merge and knows the repo wins over
the runner), item 5's spawn line (a worker that starts on the host it is given, refusing by name
when it cannot), item 6's durable evidence (rows that outlive machines), and item 7's dispatcher
tool (the human's side of the same loop). Then the first campaign runs at width 1 on the Linux
host, produces ≥ 10 rows, and the caps above get re-derived from data instead of carried.
