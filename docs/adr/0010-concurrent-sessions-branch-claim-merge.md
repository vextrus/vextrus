# ADR-0010 — Concurrent sessions: dispatcher-owned branches and claims, human-gated merge

**Date:** 2026-08-12 · **Status:** accepted

## Context

Fan-out is wanted: several cloud sessions working at once. Containers dissolve half the old
constraint for free — each session has its own filesystem, so no two share an index — but they do
nothing about the shared remote. Three hazards, all real:

- **Branch collision.** Two sessions on `main`, or on the same branch, race on push and one loses
  work silently. The legacy repo did exactly this with 25 files.
- **Verify honesty under merge.** Each session's verify is green *on its own branch*. Nothing
  proves green after merge — and with `next build` now in the lane, merged-red is likely, not
  exotic.
- **The map is in git.** Concurrent sessions claiming tickets edit the same files, so a claim
  held locally is the same as no claim.

There is no CI (`.github/workflows` is absent) and this decision deliberately does not create one.

## Decision

### The merge is GitHub's squash button, and it is legitimate only on an up-to-date branch

The button stays: the dispatcher is not always at a machine with a warm workspace, and PR #1 in
fact landed through it. A local-only merge rule would be a rule that gets broken.

What makes the button safe is that a squash of a branch which **already contains `main`'s tip**
produces a `main` tree byte-identical to the branch tree. So a session's last act is
`git fetch origin main` → **merge** `origin/main` into the branch → `pnpm verify` on that exact
tree → push → post the head SHA and verify tail as a PR comment. Merge, not rebase: a rebase
invalidates the verify that justified the commits.

GitHub cannot enforce this. "Require branches to be up to date before merging" is a sub-option of
required status checks, and with no CI there is no check to require. This is discipline until the
harness map decides whether CI exists.

### The click is the gate, and it binds the human

Nothing mechanical can confirm that a session ran verify. The guardrail is that no *session* may
be trusted about it — not that no human may. The dispatcher reads the SHA-stamped verify comment
and then clicks; **no click without the evidence comment on the current head.** If CI later
exists it slots in as a required check and the click stops carrying the weight.

### The dispatcher owns branches and claims; sessions own neither

- **Branch per session**, created by the dispatcher — in the cloud, by the harness at dispatch
  (`claude/<slug>`, no ticket number). A session never creates, renames, or switches a branch, and
  never works on `main`.
- **The dispatcher picks the ticket and sets `Claimed by:` on `main` at dispatch.** A claim
  committed on a session's branch is invisible on `main`, which is where a second dispatch would
  look — so a session-written claim cannot do the job it was designed for. Removing self-selection
  eliminates the collision class rather than mitigating it.
- A session that finds an unexpected claim **stops**; only the dispatcher breaks a stale claim.
- **The loop's unit is the arc directory**, not the ticket. Inside a campaign, workers select and
  claim freely — the boundary is one no one else is inside (`docs/specs/loop.md`).

## Alternatives put and rejected

- **Sessions push to `main` with rebase-and-verify.** Faster, no queue — but a rebase invalidates
  the verify that justified the commit and nobody re-runs it.
- **Merge is a human act on the human's machine, button banned.** Strictly stronger, and refuted
  by practice: it blocks every cloud session on the dispatcher being at a Windows workstation.
  Up-to-date-plus-verify buys the same tree guarantee without that.
- **A CI workflow as the required status check.** The correct long-run answer and the only one
  that removes trust entirely; fenced off until the harness map rules on CI, and named here as the
  seam it will slot into.
- **A session claiming on `main` directly** (a one-file markdown commit that verify cannot break).
  Rejected: it re-opens "sessions push to `main`" for a case where the dispatcher was going to act
  anyway.

## Consequences

- The dispatcher loses "go take the next frontier ticket" as a dispatch mode and must name the
  ticket — roughly thirty seconds, in the step where a mis-ordered frontier would be noticed.
- The first friction in real concurrency will be `MAP.md` conflicts: two sessions both append to
  *Decisions so far*. The second PR to land becomes un-mergeable and its session must
  fetch-merge-resolve-verify. That is the ruling working, not failing — but it is where a session
  might be tempted to resolve a conflict by discarding the other's line.
- A second session's fetch-merge-verify going red because of the first's merged work is the
  guardrail catching a genuine merged-red — the case the whole rule exists for.
- **Not yet exercised with two concurrent sessions.** The failure modes are human-side, so the
  first real two-session run is the test.

## Amendment — 2026-08-12: CI takes the evidence, the click stays human

The harness map ruled on CI (`.wayfinder/harness/tickets/13-ci-the-missing-trigger.md`): GitHub
Actions, one job running `scripts/provision.sh` — whose last act is `pnpm parity` — then
`pnpm db:replay`. The PR run becomes a **required status check with "require branches to be up to
date before merging"**. This ADR named that seam and fenced it off; it is now decided, and two
clauses above change.

**The evidence comment is superseded.** Its stated reason was *"nothing mechanical can confirm
that a session ran verify"*, and that sentence stops being true. A CI run is strictly better
evidence than a session's testimony: it runs on a machine the session cannot touch, at the head
SHA, on a tree GitHub resolved itself, and it runs the whole gate rather than the one leg a
session chose to paste. A session's last act becomes `git fetch origin main` → **merge** →
`pnpm verify` → push. It still verifies — fast feedback, and don't-push-red — it just stops
testifying. **This takes effect when the check exists**, not when the ticket closed: until the
workflow lands, the SHA-stamped comment is the only mechanism there is and the rule above stands
unchanged.

**"Require branches to be up to date" stops being discipline.** The paragraph above says GitHub
cannot enforce it because the setting is a sub-option of required status checks and there is no
check to require. There is one now, so it is enforced mechanically. Merge-not-rebase holds for the
reason already given.

**Unchanged, and load-bearing:** the required check *unblocks* the merge button — it does not
press it. **The click is still the human's and still the gate.** The dispatcher still owns
branches, tickets and claims; sessions still own neither. The alternative listed above — "a CI
workflow as the required status check", called *the correct long-run answer and the only one that
removes trust entirely* — is the one that was taken.
