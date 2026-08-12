# What a cloud session owns — branch, claim visibility, who merges

wayfinder:grilling
Status: open
Claimed by: cloud session — claude/cloud-session-ownership-nnk2sy
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

- [ ] The ruling in `## Resolution`, covering branch ownership, claim visibility, and merge.
- [ ] Written where a session will actually see it — `CLAUDE.md`'s session protocol and/or
      `.wayfinder/TRACKER.md`, whichever is the right home; not only in this ticket.
- [ ] If the loop needs different rules, the difference is stated, not left implied.
- [ ] Exercised at least once with two concurrent sessions before the ruling is called proven —
      or, if that is deferred, the deferral is named in the resolution.

## Guardrails

- Nothing enters `main` on the strength of a verify that ran on a different tree.
- No mechanism that requires a session to be trusted about whether it ran verify.
- Do not build a merge queue or CI to solve this before the map has decided whether CI exists
  (see the map's Not yet specified).
