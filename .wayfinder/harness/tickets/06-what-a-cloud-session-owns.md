# What a cloud session owns — branch, claim visibility, who merges

wayfinder:grilling
Status: closed
Claimed by:
Blocked by:

## Objective

Decide the discipline that makes several concurrent cloud sessions safe: what branch a session
may hold, when a ticket claim becomes visible to the others, and who merges.

## What forced it

The machine rule — *one writable checkout per branch, ever* — currently prevents concurrency by
making it impossible. Containers dissolve half of it for free: each session has its own
filesystem, so no two share an index. They do nothing about the shared remote, and fan-out is now
wanted. Three hazards, all real:

- **Branch collision.** Two sessions on `main`, or on the same arc branch, race on push and one
  loses work silently. The legacy repo did exactly this with 25 files.
- **Verify honesty under merge.** Each session's verify is green *on its own branch*. Nothing
  proves green after merge — and with a whole-app build now in the lane, merged-red is likely,
  not exotic.
- **The map is in git.** Concurrent sessions claiming tickets edit the same files. `Claimed by:`
  is designed for that, but only if claims are pushed promptly; a claim held locally for an hour
  is invisible, which is the same as no claim.

## The question

The prior, to be argued with: **branch per ticket, never `main`; the claim is pushed as its own
commit before any work starts; merge is a human act on your machine, never a session's.** That
keeps the property that nothing enters `main` without a green verify on the merged tree, and it
makes a claim visible at the only moment it matters.

Put and to be rejected on the record: sessions pushing to `main` with rebase-and-verify. Faster,
and no merge queue for a human to run — but a rebase invalidates the verify that justified the
commit, and nobody re-runs it.

Open sub-questions the ruling must answer:

- Branch naming, and who creates it — the session or the human dispatching it.
- What a session does when it finds a claim already set: refuse, or pick the next frontier
  ticket. Whether a stale claim can ever be broken, and by whom.
- Whether the loop (`scripts/loop/conduct.mjs`) obeys the same discipline or needs its own — it
  runs unattended, so a mistake there is unobserved until merge.
- What the human merge step actually is, mechanically, and where the merged tree's verify runs.

## Exit criteria

- [x] The ruling in `## Resolution`, covering branch ownership, claim visibility, and merge.
- [x] Written where a session will actually see it — `CLAUDE.md`'s session protocol and/or
      `.wayfinder/TRACKER.md`, whichever is the right home; not only in this ticket.
- [x] If the loop needs different rules, the difference is stated, not left implied.
- [x] Exercised at least once with two concurrent sessions before the ruling is called proven —
      or, if that is deferred, the deferral is named in the resolution.

## Resolution

**ADR-0010** carries the decision; `CLAUDE.md` §5–6, `.wayfinder/TRACKER.md` *Who claims*, and
`docs/specs/loop.md` *The campaign's unit is the arc* carry the operative rules where a session
and a dispatcher respectively meet them.

**The ruling.** The dispatcher owns branch, ticket, claim and merge; the session owns the work and
the evidence.

- **Branch per session, dispatcher-created**, `claude/<slug>`, no ticket number — in the cloud the
  harness already does this at dispatch, so no new mechanism. A session never creates, renames or
  switches a branch and never works on `main`.
- **The dispatcher picks the ticket and writes `Claimed by:` on `main` at dispatch.** A session
  never writes or clears a claim; finding an unexpected one, it stops. Only the dispatcher breaks
  a stale claim.
- **Merge is GitHub's squash button**, legitimate only on a branch that already contains `main`'s
  tip with verify green on that exact head. A session's last act: fetch → **merge** `origin/main`
  (never rebase) → `pnpm verify` → push → post head SHA and verify tail as a PR comment. The
  session never clicks.
- **The click is the gate and it binds the dispatcher** — no click without the evidence comment on
  the current head.
- **The loop differs by unit, not by rule**: its dispatch unit is the arc directory, exclusively
  the campaign's for its duration, so `frontier.mjs` self-selection and worker-written claims stay
  legal inside that boundary.

**The measurement that forced each turn.** The prior — *merge is a human act on your machine* —
was refuted by the repo's own history: `main` is linear and PR #1 landed as a squash commit
(`e79e7c1 … (#1)`), i.e. the button was already the practice, and a rule the dispatcher cannot
follow away from the Windows workstation is a rule that gets broken. What rescues the guardrail is
arithmetic, not discipline: a squash of a branch containing `main`'s tip yields a `main` tree
byte-identical to the branch tree, so verify-after-merge-in *is* verify-on-`main`. Cost: one
fetch-merge-verify cycle at ~43s.

The prior's second half — *the claim is pushed as its own commit before work* — failed on
visibility. This session did exactly that (`ce001b9`), and the claim landed on a session branch
where no second dispatch would ever look; after the no-ticket-number naming ruling, the branch
name doesn't identify the ticket either. Since the dispatcher is already sole brancher, sole
merger and sole clicker, moving ticket-selection to them eliminates the collision class instead of
mitigating it.

The guardrail *no mechanism requiring a session to be trusted about verify* cannot be met without
CI, and CI is fenced by this ticket's own guardrail. Resolved by reading it precisely: no
**session** may be trusted; the human may. The click is the mechanism, the SHA-stamped verify tail
is what is read before it.

Fact worth keeping: GitHub's "Require branches to be up to date before merging" is a sub-option of
required status checks, so with no CI **none of this is mechanically enforceable** — it is
discipline until the map rules on CI, and CI is the named seam that would take the weight.

**Alternatives put and rejected.** Sessions pushing to `main` with rebase-and-verify (a rebase
invalidates the verify that justified the commit, and nobody re-runs it). Banning the button in
favour of local human merge (refuted above). Unfencing CI here (correct long-run answer, not this
ticket's to decide). A session writing its claim directly to `main` as a markdown-only commit
verify cannot break (re-opens "sessions push to `main`" for a case the dispatcher was acting in
anyway). Ticket numbers in branch names (traceability the PR title already carries).

**Deferred, named.** Not exercised with two concurrent sessions — the failure modes are human-side
and a session dispatching a second session to test the rule would be breaking the rule to test it.
The first real two-session run is the test; what it must be watched for, in likely order:
(1) `MAP.md` conflicts as both sessions append to *Decisions so far* — the second PR becomes
un-mergeable and must fetch-merge-resolve-verify, which is the ruling working, but is where a
session might resolve a conflict by discarding the other's line; (2) a claim set at dispatch whose
container never starts — the stale-claim path, dispatcher-only; (3) a second session's
fetch-merge-verify going red from the first's merged work, which is the guardrail catching a
genuine merged-red.

## Guardrails

- Nothing enters `main` on the strength of a verify that ran on a different tree.
- No mechanism that requires a session to be trusted about whether it ran verify.
- Do not build a merge queue or CI to solve this before the map has decided whether CI exists
  (see the map's Not yet specified).
