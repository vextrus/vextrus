# What a disposable machine makes possible

wayfinder:grilling
Status: closed
Claimed by:
Blocked by:

## Objective

Name the work that a disposable, parallel, Linux-native, unattended machine makes possible and
this Windows checkout does not — and decide which of it Vextrus actually wants. The output is a
short ranked list with reasons, not an inventory.

## What forced it

Charting surfaced that cloud and local are not the same machine in two places: they differ in a
property unrelated to parity. This box is *precious* — one writable checkout, uncommitted work,
WinNAT port reservations that break and stay broken. A container is *disposable*: wrong state is
fixed by discarding it.

Capacity ("more of me, elsewhere") is the obvious use and is covered by other tickets. This one
is about capability — things that cannot happen here at all. Candidates already visible:

- Cold provisioning and the native-Postgres path (ticket 02 takes this one; it is the proof that
  the property is real).
- Destructive rehearsals: `db:migrate` from an empty database, a migration run against a seeded
  copy, dropping and rebuilding to test recovery.
- "Does this repo work for someone who just cloned it" — the new-contributor path, which a
  provisioned machine can never answer.
- Linux-native behaviour: the CI/deployment target's OS, path semantics, and case sensitivity,
  none of which Windows exercises.
- Long or unattended runs that would hold this machine hostage.

The question is which of these are worth building a habit around, and what each costs.

## The question

For each candidate: does it produce a fact the project needs, how often, and what has to exist
for it to be repeatable rather than a one-off? A capability nobody will invoke twice is not worth
charting. The ruling should end with a *ranked* short list, each item either promoted to its own
ticket or explicitly declined with the reason.

Also to be surfaced honestly: what disposability costs. A machine you can discard is a machine
whose state is not evidence — a result from a container nobody can re-enter is a claim unless the
means of reproducing it lives in the repo.

## Exit criteria

- [ ] A ranked list in `## Resolution`, each item promoted to a ticket or declined with a reason.
- [ ] For anything promoted: the ticket created and wired into the map.
- [ ] The cost of disposability stated — what makes a result from a discarded machine citable.

## Guardrails

- Ideas are ranked by the fact they produce, not by how interesting they are.
- Nothing here overrides the map's Out of scope: production deployment stays out, however
  naturally a disposable machine invites it.
- Destructive rehearsals happen in a container, never against `localhost:5544` on this machine.

## Resolution — 2026-08-12

### The ranking axis

**Staleness rate × has-an-invoker, with severity breaking ties.** Not "the fact it produces" alone
— every candidate produces a wanted fact, so that axis separates nothing. What separates them is
how fast the fact goes stale (event-shaped: a migration lands, `provision.sh` changed — versus
per-commit) and whether anyone can actually invoke it. With **no CI anywhere in this repo**
(`.github/` does not exist), every repetition is a human deciding to open a cloud session, so a
capability that only pays off per-commit has no invoker and cannot be charted as a habit.

The alternative put and rejected: rank by **severity alone** — what it costs when the fact is
wrong and nobody knew. Rejected as the primary axis because it promotes capabilities nobody will
ever invoke a second time, which is precisely what the ticket forbade. Kept as the tiebreaker,
where it did real work: it is what puts a migration meeting rows above everything else.

### The collapse — the list was shorter than it looked

Three of the five candidates are one act. Cold provisioning, "`db:migrate` from an empty database",
and "does this repo work for someone who just cloned it" are the same container doing the same
thing: ticket 02's cold run **already** applied 11 migrations to nothing, and a cloud session **is**
a fresh clone into an empty machine. The only residual in the new-contributor path is that a human
reads prose and types commands where the harness executes `provision.sh` — a **documentation**
fact, low severity (a confused human asks; a wrong quantity does not ship), and it needs no
container to check.

### The ranked list

1. **[The gate runs cold](09-the-gate-runs-cold.md)** — *promoted, `task`, unblocked.*
   Stale **today**: ticket 04 changed `provision.sh` to gate on `pnpm parity` and closed with
   "not yet run cold on a fresh container", so every cold run since has landed on untested code.
   Ranked first not on severity but on order — everything else on this map runs *inside* the thing
   it proves, and a wrong gate means non-zero exit on every fresh cloud machine.

2. **[A migration meets rows](10-a-migration-meets-rows.md)** — *promoted, `task`, blocked by 09.*
   The highest severity on the board and the tiebreaker's one real intervention. Every migration
   this repo has run has run against an **empty** database — `provision.sh` migrates nothing,
   `test:db` builds fixtures on an already-migrated schema, `db-drift` never reads a row. A
   migration that mangles register rows breaks identity stability across revisions *quietly*, as a
   wrong quantity rather than a red build. Form ruled in: replay-with-rows reusing `test:db`'s own
   fixtures (migrate to N−1 → populate → apply N → re-run). Staleness is event-shaped with a real
   invoker: a migration lands, the author runs it.

### Declined, with reasons

- **The new-contributor path** — a cold `provision.sh` run *is* it. The residual is a docs check
  that needs no container.
- **Linux-native behaviour** (case sensitivity, path semantics, the `cad/` lane) — no invoker of
  its own: it goes stale every commit and nothing but a human could run it. Severity does not
  rescue it — a divergence surfaces as a **red build**, loud and cheap, not as a wrong number.
  Decisive: the fact is already produced **free** by every cloud session, since ticket 04 made
  `provision.sh` end in `pnpm parity`. The real gap is that nothing forces a Linux run before
  merge — which is [ticket 06](06-what-a-cloud-session-owns.md)'s, plus the map's CI fog, where
  the note now records that the check is already written and needs only a trigger.
- **The loop / unattended runs** — capacity by this ticket's own exclusion; its container-specific
  blockers (branch, push discipline) are already ticket 06's, which names it. And there are **no
  arcs anywhere** (`find .wayfinder -type d -name arcs` is empty), so it has zero possible
  invocations today. Its one genuine fact-producing use — re-deriving `MAX_TURNS = 150` and the
  30-minute fuse, which `loop.md` marks "re-derive, don't trust" and which a precious machine
  makes nobody want to run — goes to the map's fog, blocked on an arc existing.
- **Drop-and-rebuild recovery** — it *is* the cold path, against a dev database with nothing in it
  worth recovering.
- **A seed corpus** for the migration drill — put and rejected in favour of reusing `test:db`:
  a corpus needs its own owner and goes stale silently, and a stale seed produces a false green.
  Recorded in ticket 10 so reopening it is a decision, not an implementation detail.

### The cost of disposability — what makes a discarded machine's result citable

A machine you can discard is a machine whose state is not evidence. Made concrete during this
ticket: **`.data/` is gitignored** (`.gitignore:33`), so `.data/provision.log` — ticket 04's whole
evidence trail — is written and then destroyed with the container. It is a debugging aid for the
session still alive, never a record.

Three rules, in descending strictness:

1. **The reproducer is a repo script, not a transcript.** No result is citable unless the command
   that produced it is versioned and invocable by name — `bash scripts/provision.sh`, `pnpm parity`,
   `pnpm checkup`. If producing it required an ad-hoc sequence typed into a container, the sequence
   becomes a script before the number is quotable.
2. **The result carries what varied.** Cloud images are not stable ground — two consecutive
   sandboxes differed in Docker and system Python. A container result states the image-identifying
   facts it depended on. This is why ticket 02's result is still usable ("binary at
   `/usr/bin/docker`, no daemon") and why a bare "cold path works, 25s" would not be.
3. **The ticket `## Resolution` is the archive.** Anything that must outlive the container is
   transcribed by the session that observed it, before it ends. A number nobody transcribed is gone.

Rejected: **committing provisioning logs** (un-ignoring `.data/`, or a run-record file). Every cold
run becomes a diff, the logs rot into noise, and the useful content is the two or three lines a
human would have transcribed anyway.

Rule 2 gets a **mechanism rather than a discipline**: an environment fingerprint — which Postgres
path was taken and its version/origin, whether a Docker daemon existed, the run's date — produced
automatically instead of remembered. Homed in **`pnpm checkup`**, which already prints the session's
Node against the engines pin, and which a cold run already reaches (`provision.sh` → `parity.sh` →
checkup). Rejected: a new `echo` block at the tail of `provision.sh`, which would print Node twice
from two code paths that can disagree — exactly the scatter ticket 03 ruled against. Rejected: a
ticket of its own, whose entire content would be four probes on a surface that exists; the work is
folded into [ticket 08](08-the-provisioner-knows-what-it-installed.md), which already owns
installed-vs-ambient and already requires a fresh-container proof run.

This extends checkup's charter: it now **describes** as well as **judges**. The constraint that
keeps ticket 03's ruling intact — **descriptive lines never affect the exit code.** "Postgres came
from apt, not compose" is not a fitness question; both are fit.

