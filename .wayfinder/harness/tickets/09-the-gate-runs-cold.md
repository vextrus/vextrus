# The gate runs cold

wayfinder:task
Status: open
Claimed by:
Blocked by:

## Objective

Run `scripts/provision.sh` on an empty container now that it gates on `pnpm parity`, and record
whether it earns its "ok" without a human touching it.

## What forced it

[The cold machine](02-the-cold-machine.md) proved the cold path — empty container to migrated in
~25s, all three legs green. Then [The provisioner earns its "ok"](04-the-provisioner-earns-its-ok.md)
**changed the script**: `provision.sh` now ends by running `parity.sh` (checkup → verify →
`test:db` → a `next dev` boot probed for 200 and killed) and exits non-zero if any leg fails. That
ticket closed with one criterion open — *"Not yet run cold on a fresh container"* — because every
leg was proven on this already-provisioned machine.

So the fact ticket 02 produced is about a provisioner that no longer exists. Every cold run since
has landed on untested code, and the failure mode is not subtle: a wrong gate means `provision.sh`
exits non-zero on **every fresh cloud machine**, which blocks every other use of a disposable
container — including the migration drill that needs one to run in.

[What a disposable machine makes possible](07-what-a-disposable-machine-makes-possible.md) ranked
this first for exactly that reason: it is stale today, and everything else runs inside it.

## The question

Not a decision — a measurement. Does a container that started empty reach
`provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed`?

What the run must produce:

- The exit status, and if non-zero, which parity leg failed and whether the fault is the gate or
  the machine.
- Wall clock for the whole cold run, split provisioning vs parity, against ticket 02's ~25s
  provisioning and ticket 04's 61s parity on a warm machine.
- Which Postgres path the container took, and whether a Docker daemon existed — ticket 02 found
  the binary present and the daemon absent, and the map's Notes say cloud images are not stable
  ground.
- Whether the `next dev` boot probe behaves on a machine where nothing has ever bound :3210.

## Exit criteria

- [ ] `bash scripts/provision.sh` run on a container that started empty, exit status recorded.
- [ ] If it fails: the failing leg named, the cause diagnosed, and the fix landed — then re-run
      cold on a *second* empty container, because a fix proven on the machine it was written on
      is the thing this ticket exists to stop.
- [ ] Timings recorded in `## Resolution`, split provisioning vs parity.
- [ ] The environment facts the result depended on transcribed into `## Resolution` — Postgres
      path and version, Docker daemon present or not, the Node the session actually got. `.data/`
      is gitignored, so the log dies with the container; what is not transcribed is gone.

## Guardrails

- Proof is a **new** empty container, never this machine. A green re-run here says nothing —
  it is the path least likely to be broken.
- Do not weaken or skip a parity leg to get to "ok". If a leg is wrong, the leg is wrong.
- No fix to `provision.sh` counts until it has run cold on a container that never saw the fix
  being written.
