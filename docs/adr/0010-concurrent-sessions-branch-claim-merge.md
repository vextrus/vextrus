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

## Amendment #2 — 2026-08-13: the click stops being the gate; landing becomes a non-author act

The first amendment was written the day this ADR was, before any of it had run. It has now run:
nine branches, nine PRs, merged between 06:00Z and 07:12Z on 2026-08-13. The consequences section
above says *"not yet exercised with two concurrent sessions … the first real two-session run is the
test."* This is that test's result, and three clauses change. Evidence throughout:
`docs/specs/cloud-campaign.md` §1, measured on `main@00c6ce3`.

### The click was not the gate it was described as, and it could not survive being one

The clause held that the dispatcher reads the evidence and then clicks. Amendment #1 already
retired its *verification* half — CI is better evidence than testimony. What remained was the click
as a **review** gate, and that is the part the wave refuted:

- `main` carries required check `parity` with `strict: true` and `enforce_admins: true`. The
  instant PR *n* merges, PRs *n+1…9* are out of date and cannot merge. Every session had already
  run `pnpm land` and **exited**, so each remaining PR needed a party that did not exist — the
  system had **no non-author actor capable of re-landing a PR.**
- The only way forward was to argue the author session out of `CLAUDE.md`'s "you never merge the
  PR", **2–3 times in 72 minutes**. This ADR's own rejection of a local-only merge rule — *"a rule
  that gets broken"* — turned out to describe this one.
- An unattended campaign has no reviewer awake at all, so the clause does not merely slow AFK
  execution; it forbids it.

**Ruled: the merge is mechanical and non-author.** `CLAUDE.md` now says *"You never merge your own
PR: landing is not the author's act."* The landing party is the merge queue where one exists, the
conductor otherwise, and the dispatcher by hand in either case. What this protects is **doer ≠
judge** (ADR-0008) — not the human's finger, which was only ever that law's implementation for a
repo with no CI and no second actor. `parity` + `strict` are already out of the author's reach.

*Put and rejected:* deleting the sentence outright, which leaves self-merge unregulated — a session
that verifies, judges and lands its own work is exactly the configuration the loop is founded
against. And keeping the click, refuted above by its own reasoning.

### Claims become a compare-and-swap, when there is a conductor to make them

The clause *"the dispatcher sets `Claimed by:` on `main` at dispatch"* has the right intent — a
claim must live where a second dispatch would look — and no mechanism: it is a human editing a file
and pushing, which races against itself as soon as dispatch is automated.

**Ruled: the conductor writes claims through the GitHub contents API with the blob `sha` as an
if-match precondition** — an atomic compare-and-swap, no checkout, no push, no
`VEXTRUS_ALLOW_MAIN_PUSH`, correct under N concurrent dispatchers. **This takes effect when the
conductor exists** (`docs/specs/cloud-campaign.md` §6), not when this amendment lands; until then
the dispatcher claims by hand exactly as the clause above says.

### The arc-directory exemption is retired on the same condition

*"The loop's unit is the arc directory, not the ticket"* exists **only** because there was no
atomic claim — self-selection was legal inside a boundary no one else was inside. An atomic claim
removes the premise, and extending the exemption to N parallel cloud workers would be unsound: they
are not inside one boundary. **When claims become compare-and-swap, the unit returns to the ticket**
and the exemption goes rather than growing. Until then it stands unchanged.

### Also ruled: squash-only

History is currently mixed — #16–#23 landed as merge commits, #24 and #25 squashed. Squash-only
makes `main` one commit per ticket, which is what the boundary review's `git diff <arc-start>..HEAD`
scope assumes and what makes `git log --oneline` a ticket ledger. This ADR's own tree-identity
argument — a squash of an up-to-date branch produces a byte-identical `main` tree — already assumed
it. **Disabling merge commits is a repository setting and therefore a human action**, named here so
it is not mistaken for done, exactly as ADR-0011 named branch protection.

### What does not change

Merge, never rebase. Branch per session, dispatcher-created; a session never creates, renames or
switches one. A session that finds an unexpected claim stops. The up-to-date requirement — now
mechanical, and the reason the landed tree is the tested tree.
