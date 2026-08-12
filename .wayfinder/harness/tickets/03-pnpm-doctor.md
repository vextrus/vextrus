# `pnpm doctor` — what the workspace must report about itself

wayfinder:grilling
Status: open
Claimed by: claude (session 5cc892ca)
Blocked by: 02-the-cold-machine.md

## Objective

Decide what a workspace must be able to say about itself, and build the one command that says it.
The convergence point for the legibility axis: a session that is *suspicious* has somewhere to
look, and provisioning has something to earn its "ok" against.

## What forced it

Nearly every entry in `docs/TRAPS.md` is a question the agent could not answer cheaply, so a
human answered it once and wrote it down: which database am I actually in; is the schema drifted;
is a dev server holding the port; is `NODE_ENV` poisoning the build. Prose costs a file read and
correct recall at exactly the moment a session is already confused — and ADR-0007's own principle
is that quality comes from the environment, not from more prompt text.

## The question, stated fairly

Scattered reporting was put and rejected: each failure site explaining itself is precise and adds
no new surface, but it only helps where something already failed, and it leaves a suspicious
session with nowhere to look. One command was chosen because the self-proving parity check the
provisioner needs and the "what is wrong here" command a session needs are the same artifact
pointed in two directions.

What remains to decide:

- **The line list.** The prior: resolved database identity (host, port, database, role, and
  which listener actually owns 5544), drift status, port ownership for 3210, Node/pnpm/uv/Python
  versions against what the repo requires, `NODE_ENV`, storage root existence and writability,
  git identity and branch. Each line must trace to a trap that actually bit — that is the bound
  that keeps this from becoming a dashboard.
- **Exit-code semantics.** Non-zero when something is *wrong*, not when something is merely
  worth knowing. Where the line between "broken" and "notable" falls, and whether there is a
  third state for "cannot tell".
- **Cost.** It must be cheap enough to run on a hunch. If it needs a live database to report on
  the database, what it does when there isn't one — report the absence, never hang.
- **Relationship to verify.** It is *not* a verify stage: verify is the tree's contract and must
  not become sensitive to daemons (ADR-0007, fail-closed). Doctor is about the machine.
- **What retires.** Which `docs/TRAPS.md` entries become mechanism and are cut from the prose,
  and which are irreducibly environmental and stay.

## Exit criteria

- [ ] The ruling recorded in `## Resolution`: line list, exit-code semantics, and what doctor is
      explicitly not.
- [ ] `pnpm doctor` implemented and run on this machine, output pasted into the resolution.
- [ ] Proven to fire: at least one deliberately broken condition (wrong port owner, stopped
      database, or a drifted schema) detected and reported correctly, then reverted.
- [ ] The `docs/TRAPS.md` entries it retires actually cut from that file in the same change.
- [ ] `pnpm verify` green, duration recorded — doctor must not have crept into the lane.

## Guardrails

- Every line traces to a trap that bit. A line no one needed is a line that will go stale.
- Doctor reports; it does not repair. Repair is `provision.sh`, which is idempotent by design.
- It must not require a live database to run, or it is useless in the case it exists for.
