# What a disposable machine makes possible

wayfinder:grilling
Status: open
Claimed by: claude/disposable-machine-possibilities-14i8bq
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
