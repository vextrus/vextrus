# The provisioner knows what it installed

wayfinder:grilling
Status: open
Claimed by:
Blocked by:

## Objective

Decide how `scripts/provision.sh` distinguishes *what node is on PATH* from *what node I
installed*, and what a session is owed when the two disagree.

## What forced it

[The cold machine](02-the-cold-machine.md) measured two faults on a cloud sandbox, both from
that one confusion:

- The guard `if [ "$(node_major)" -lt 24 ]` reads ambient `node`, which is the image's Node 22.
  So a **re-run on a fully provisioned machine re-downloads and re-untars Node 24 every time**.
  Harmless at 8.7s with egress open; it makes "re-running is the repair" depend on network
  egress to redo work already done, and fails on a machine whose egress has since closed.
- After installing, the script `export`s the new path into its own shell, so its final check
  measures 24 and prints success — while **the session that inherits the machine gets Node 22**,
  because the container puts `/opt/node22/bin` ahead of `/usr/local/bin` and a session shell
  reads neither `profile.d` nor `.bashrc`. Every pnpm call warns `Unsupported engine`, and
  nothing blocks.

Verify is green on both Nodes (41.5s on 22, 34.1s on 24), so this is drift and a broken engine
pin, not a correctness failure today. It is the kind of divergence this map exists to end:
the machine reports success while being materially not the machine that was asked for.

## The question

- **Where the fix belongs.** Detection (`pnpm doctor` reports the session's Node) versus
  correction (provisioning wins the PATH fight) versus enforcement (verify *fails* on a Node
  below the engines pin instead of pnpm warning). These are not exclusive and probably want
  ordering, not choosing.
- **Whether the repo can win a PATH set by the container**, or whether it should stop trying —
  the alternative being that every entry point resolves its own Node explicitly rather than
  trusting PATH at all. The bootstrap in the cloud setup field is the one place the repo
  already controls before a session starts.
- **What "provisioned" means as a testable state**, so the re-run can skip work it has done
  without asking the network — a marker with the installed version in it, or probing the
  install path directly rather than PATH.

## Exit criteria

- [ ] The ruling in `## Resolution`, covering all three axes above.
- [ ] A re-run on a provisioned machine with **egress blocked** succeeds — the standing proof
      that "re-running is the repair" no longer depends on the network.
- [ ] A session on a fresh container reports Node ≥24 with no `Unsupported engine` warning,
      *or* the decision to accept the image's Node is recorded with what makes it safe.
- [ ] `pnpm verify` green, duration recorded.

## Guardrails

- Not `NODE_ENV`, and not weakening the engines pin to silence the warning.
- The provisioner stays idempotent; a marker that goes stale and skips real work is worse than
  the re-download it replaces.
- Proof is a *new* empty container, not the machine the fix was written on.
