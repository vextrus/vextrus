# Secrets and git identity in a sandbox

wayfinder:grilling
Status: closed
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

## Resolution

**The provisioner invents nothing, nothing outlives a container, and the checkup line ticket 03
deferred here is discharged by refutation rather than shipped.** Two of the three faults this
ticket was built on did not survive being measured.

### What may a provisioner invent — nothing

`head -c 32 /dev/urandom` is deleted. `BETTER_AUTH_SECRET` is the fixed, self-labelling
`dev-only-secret-rotate-in-prod` that `.env.example` has documented all along — and that
`provision.sh` already accepted as its own fallback when `/dev/urandom` was missing, which was the
script admitting the fixed value is fine.

Rotation was put first and accepted, then **argued down in favour of not generating at all**. A
random per-container secret is *a variable nobody chose*: this map exists to make a session behave
identically on every machine, and randomness manufactures divergence for a value with no
dependents (no code in this repo reads it — `src/core/auth.ts` never passes `secret`; better-auth
reads the env var itself), no threat model (it guards a localhost database whose password is
`vextrus_dev_password`), and no secrecy. Worse, the divergence already ran the wrong way: a
workstation that copied `.env.example` held the fixed value while every cloud container held a
random one, so two machines nominally at parity differed by construction. The generator's stated
defence — *a fixed secret is a habit that rides into production* — was rejected on this map's own
terms: production deployment is explicitly out of scope, `provision.sh` is not a deployment path,
and a random value protects a bad deploy no better, it only makes it fail differently.

### What must outlive a container — nothing, and that is a finding

- **The secret** is a constant, so there is nothing to persist.
- **The push credential never lands on this machine at all.** No `credential.helper` is
  configured, `~/.ssh` is empty, and `GH_TOKEN`/`GITHUB_TOKEN` are the literal string
  `proxy-injected` — a sentinel. Authentication is injected in flight by the loopback agent proxy
  on `127.0.0.1:36805`; `git ls-remote origin HEAD` returned `cb654d2`, so the path works end to
  end. This closes the ticket's fourth question *without new machinery*: **there is nothing here
  that could leak into `.env` or the repo, because nothing here holds it.** `.gitignore` already
  carries `.env` / `.env.*` with `!.env.example` as the sole exception, and ticket 13 established
  the repo is public, so GitHub push protection applies for free. A secret-scanning check was
  declined as a mechanism guarding an empty room.
- **The signing key is the platform's.** See below.

### The provisioner owns `.env`, and derives it from `.env.example`

`provision: .env exists — leaving it alone` is retired. The skip existed to stop a *generated*
secret from churning; with nothing generated it had no job left, and its cost was live on the very
container that closed this ticket — `.env` dated `Aug 12 10:37`, the image build time, holding an
earlier session's random secret, with `provision.log` absent (never provisioned here). A
snapshot-restored container kept a stranger's secret forever, and fixing the generator alone would
never have reached the machines that actually had the problem.

`.env` is now **rewritten whole, every run, copied from `.env.example`** — which is promoted from
illustration to *source*. The two files previously restated the same three connection strings, so
changing a password in one left the other silently disagreeing, on precisely the axis this
provisioner exists to close. The provisioner contributes only what a committed file cannot know:
this checkout's absolute path, and the machine's environment. Every key prefers an exported
ambient value, so **the override channel is the environment, not a hand-edited file** — it
survives the rewrite by design rather than by luck. Comments copy through (`process.loadEnvFile`
ignores them), and a missing `.env.example` now fails the `env` phase by name instead of being
silently survivable. Confirmed by construction: `diff .env.example .env` is **one line**, the
storage root. The rewrite prints, so the act is visible in `provision.log`.

Cost named and accepted: a machine with a hand-edited `.env` and nothing exported loses the edit.
Confirmed with the human that no such edit exists.

### The checkup line — INFO, and no gate

Ticket 03 deferred a git line *"but not before something sets the standard it would assert"*.
Measured, **there is no standard here to assert**, and each gating candidate fails ticket 03's bar
that a line must trace to a fault that actually bit:

- **Signing configured, key present** — the fault never bit and cannot. Ticket 02 recorded
  `signingkey` as pointing at *"a path that does not exist under `HOME=/root`"*. It exists — a
  0-byte file owned by `claude` — and the platform's `gpg.ssh.program` ignores it and signs
  anyway: a probe commit in a throwaway repo exited 0 carrying a real
  `gpgsig -----BEGIN SSH SIGNATURE-----`, and all three recent repo commits (cloud session,
  workstation, GitHub merge) carry one. **That row was inferred from a directory listing; no
  commit was ever made to test it** — corrected in place in ticket 02. A line asserting the key
  file is non-empty would have gone BROKEN on a machine that signs perfectly.
- **Identity set at all** — self-reporting. `git commit` with no `user.email` fails loudly and
  names its own repair; a check that duplicates a good error message is prose.
- **Remote reachable** — the only candidate that could catch something real, since ADR-0010 makes
  the session push its own evidence and discovering you cannot at the *end* is the most expensive
  place to find out. **Rejected anyway**: a network round trip inside a command that runs in ~1s,
  failing for reasons unrelated to whether this machine can run verify, is the false accusation
  ticket 09 spent itself deleting. Fitness is *verify, `test:db` and dev can run*; pushing is not
  in that set.

What shipped is one **`INFO git`** line — identity, whether signing is on, and which program does
it — three local `git config --get` reads, no network, structurally unable to gate. It earns its
place the way ticket 07's environment stamp does: not by judging but by making later artifacts
citable, because the committing identity **differs by machine and neither value is this repo's**
(`Claude <noreply@anthropic.com>` on a container, the human on the workstation), and ADR-0010's
evidence trail is only traceable if something recorded which one a container was.

### Out of scope, with the reason

**Signature *verification*.** `gpg.ssh.allowedSignersFile` is unset, so `git log --show-signature`
errors and `%G?` reports `N`/`E` on every commit. Closing it would mean committing an
`allowed_signers` listing three public keys the repo does not own — an undocumented platform
binary's, the workstation's, GitHub's web-flow — in a file that goes stale silently and whose only
symptom when stale is the message we have today. Nothing in the feedback loop verifies signatures;
the place it would matter is a branch-protection required-signatures rule, a different lever
alongside ticket 13's required check, and a different ticket. Recorded on the map.

### Proven

Run on the snapshot-restored container that carried the stale secret, at this branch:
`provision: wrote .env from .env.example`, the generated secret replaced by the placeholder,
`diff` against `.env.example` exactly one line. `checkup` **fit for work in 1.5s** with the new
line reading `git   Claude <noreply@anthropic.com> · signing on via /tmp/code-sign`.
