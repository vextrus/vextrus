# The provisioner knows what it installed

wayfinder:grilling
Status: closed
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

- [x] The ruling in `## Resolution`, covering all three axes above.
- [x] A re-run on a provisioned machine with **egress blocked** succeeds — the standing proof
      that "re-running is the repair" no longer depends on the network. *(Blocked by shim, not
      by packet filter — see the caveat in the resolution.)*
- [x] A session on a fresh container reports Node ≥24 with no `Unsupported engine` warning,
      *or* the decision to accept the image's Node is recorded with what makes it safe.
- [x] `pnpm verify` green, duration recorded.

## Guardrails

- Not `NODE_ENV`, and not weakening the engines pin to silence the warning.
- The provisioner stays idempotent; a marker that goes stale and skips real work is worse than
  the re-download it replaces.
- Proof is a *new* empty container, not the machine the fix was written on.

## Resolution

**Correct, then detect, then enforce — in that order, and all three.** The three axes were never
alternatives; putting them in an order is the ruling.

### 1. Correction: the repo wins the PATH fight by shadowing

`provision.sh` walks the *session's* PATH in order and, for every directory ahead of our install
that holds a `node` below the pin, points its `node`/`npm`/`npx`/`corepack` at ours, moving the
displaced binary to `<name>.vextrus-displaced`. A shadow it cannot apply is a **hard failure** —
the provisioner will not report a machine it did not deliver.

Walked, not hardcoded: `/opt/node22` is a fact about one image, and this map's own note is that
images are not stable ground. A hardcoded path would keep passing on the image that moves it,
which is the failure mode the ticket exists to end.

*The alternative put and rejected:* every entry point resolves its own Node instead of trusting
PATH. It does not survive contact — a session types `pnpm verify`, and `pnpm` is itself resolved
by PATH and is a Node script. Wrapping "every entry point" means wrapping the thing a human
types, which the repo does not control. Shadowing is the only lever that precedes us, because
**no file the repo can write is read by a bare `sh -c`** — not `profile.d`, not `.bashrc`. That
sentence is the whole reason this ticket was hard.

### 2. "Provisioned" is a probe, never a marker

The install directory is globbed and the binary is **asked its own version**. No marker file: a
marker is a claim about the machine stored beside the machine, and the guardrail on this ticket
is explicit that a stale marker skipping real work is worse than the download it replaces. The
thing asserted is the thing measured, so it cannot go stale.

The node phase now answers three separate questions — *is a Node ≥ the pin already here* (ambient
first, then the install dir; no network), *fetch one only if not*, *make every shell resolve it
(unconditional)*. The third moving outside the install branch is half the bug: a machine with
Node 24 unpacked but unshadowed could never be repaired by a re-run while the treatments lived
under `if we just installed`.

### 3. Enforcement: the pin gets teeth on both sides

- `verify.mjs` exits 1 below `engines` **before stage one** — free, no subprocess, no daemon, so
  ADR-0007's fail-closed rule is untouched. It holds on every machine, not just provisioned ones.
- `checkup`'s node line goes **NOTE → BROKEN** below the pin. Divergence (other node binaries at
  other versions) stays a note, and after shadowing it falls silent on its own — every `node` on
  PATH resolves to the same install, which is exactly what the cold container measured.

### The measurements that forced it

**The fault reproduced inside the session that fixed it.** Two consecutive tool calls in this
session got different PATHs: one carried the `.bashrc` prefix and ran Node 24; the next did not,
and ran `/opt/node22/bin/node` v22.22.2 — with `pnpm` itself coming from `/opt/node22/bin`. The
drift is not a cloud-image curiosity; it is intermittent *within one session*.

**Egress-blocked re-run: exit 0 in 52s**, `node v24.19.0 already installed … — no download`,
parity green. *Caveat, and it is the honest limit of this proof:* the intended block was
`iptables -A OUTPUT ! -o lo -j REJECT`, which the permission classifier declined. The fallback
was `curl`/`wget` shims that pass loopback through and fail everything else, plus proxy vars at a
dead port. That proves **the provisioner makes no outbound call**, not that nothing on the
machine could. A packet-level proof is still owed.

**Cold container, empty, running this branch at `174ce4c`** — the proof the guardrail demanded,
not the machine the fix was written on ([the raw capture](08-cold-proof.md)):

- provisioning finished, **parity ok in 52s**, ~71s total wall clock;
- node phase **downloaded** — correct, the machine genuinely had none ≥24;
- shadowed `/opt/node22/bin`, one `node.vextrus-displaced` on the whole PATH;
- profile-free shell resolves `v24.19.0`, and *all four* `which -a node` entries are v24 or
  symlinks to it;
- **zero `WARN Unsupported engine`** anywhere — provision log, checkup, full verify stream;
- `pnpm verify` green (25.6s cold container; **27.9s** here, down from 43.5s on Node 22 — the pin
  being held is itself worth that much).

**This also discharges ticket 04's one open criterion**: a cold container has now passed the
parity gate with the gate in place.

### What the cold proof found that this ticket does not own

`pnpm checkup` on that container exits 1 on **database**: the native Postgres cluster did not
survive a restart of the container's process tree, though it was green throughout provisioning
and `test:db` ran 46 tests against it. Not a provisioning defect and not this ticket's business —
checkup named the broken thing and pointed at the repair, which is exactly its contract. Handed
to the map as fog.
