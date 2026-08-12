# Secrets and git identity in a sandbox

wayfinder:grilling
Status: open
Claimed by:
Blocked by:

## Objective

Decide what a sandbox is allowed to generate, what must outlive a container, and what credential
a session pushes and signs with — then give `checkup` the git-identity line ticket 03 promised it.

## What forced it

**Ticket 03 deferred a checkup line to this ticket by name.** Its ruling: git identity earns a
line, *"but not before something sets the standard it would assert"*. Until that standard exists,
the line has nothing to check against, and the debt is explicit and outstanding.

Two concrete faults are already on the record:

- **`provision.sh` regenerates `BETTER_AUTH_SECRET` on every run** (`head -c 32 /dev/urandom`).
  Correct for a dev container that dies in an hour; unexamined for anything that outlives one, and
  unexamined for what happens when two machines that are supposed to be at parity hold different
  secrets. Note the interaction with ticket 09: a snapshot-restored container carries a secret
  baked into an image layer by *some earlier session*, and `.env exists — leaving it alone` means
  it is never refreshed.
- **Commit signing points at a path that does not exist.** Ticket 02 found `commit.gpgsign=true`
  and `gpg.ssh.program=/tmp/code-sign` with `user.signingkey` under `/home/claude/.ssh/…`, while
  the sandbox runs as root with `HOME=/root`. Signing is configured, its key is elsewhere, and
  nothing reports the mismatch.

## The question

1. **What may a provisioner invent?** `BETTER_AUTH_SECRET` is invented today. Is "generated per
   container, never persisted" the ruling — in which case say so and make it deliberate rather
   than incidental — or does anything need to survive a container, and if so, held where?
2. **What credential does a session push with, and what signs its commits?** ADR-0010 makes the
   session responsible for pushing evidence and the human for merging; a session that cannot push,
   or that pushes unsigned when the repo expects signatures, breaks that protocol quietly.
3. **What does the checkup line assert?** Only once (1) and (2) have answers. Candidates: identity
   set at all, signing configured *and* its key present, remote reachable. Ticket 03's bar applies
   — each line must trace to a fault that actually bit.
4. **What must never enter `.env` or the repo?** The commercial guardrail is absolute about what
   this repo may contain; a secrets ruling is the natural place to state the boundary mechanically
   rather than trusting review.

## Guardrails

- No real credential, key, or token may land in the repo, a fixture, a ticket, or a log — this
  ticket is about *where secrets live*, and it must not become a place one lives.
- `.env` is written by `provision.sh` and left alone if present (ticket 09 confirmed the skip on
  every snapshot-restored container). Any ruling that requires rewriting it must say what happens
  to a machine that already has one.
- A checkup line that gates must be able to fail; a line that merely describes takes `INFO` and
  never touches the exit code.
