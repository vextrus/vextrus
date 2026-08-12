# The cold machine — proving the provisioner from zero

wayfinder:task
Status: closed
Claimed by:
Blocked by:

## Objective

Run `scripts/provision.sh` on a container that started empty, all the way to a session that can
work, and record every divergence from this machine. The output is a fact list, not a fix list —
later tickets are designed against it.

## What forced it

The provisioner's cold path is unfalsifiable locally. This Windows checkout is already
provisioned, so the only path it can exercise is the idempotent re-run — the path least likely to
be broken. Meanwhile the script's own closing line claims `pnpm verify`, `pnpm test:db` and
`pnpm dev` all work, while its exit code only reports whether `pnpm db:migrate` succeeded. That
claim has never been checked by anything.

Two cloud images already differed in Docker availability and system Python, and a third fault
(`NODE_ENV=development` in the ambient environment) reached a human round-trip before anyone saw
it. Each was found by accident. This ticket finds them on purpose.

## Facts already in hand

From two failed setup runs on 2026-08-12, before this ticket was formally taken:

- The sandbox runs as **root**, with **`HOME=/root`** but **`PWD=/home/user`**, and the checkout
  at **`/home/user/vextrus`**. `$HOME` is not where the code is — a bootstrap that searches from
  `$HOME` finds nothing.
- A bare `set -euo pipefail` script reports only "exit code 1" through the setup field. The ERR
  trap added in `ccb20b7` (phase, line, command, true exit code) is what made the second run
  diagnosable; keep any future failure's full output in this ticket.
- `scripts/provision.sh` was committed mode 644, which breaks a bootstrap that `exec`s it
  directly. Fixed to 755.

Third run (bootstrap succeeded, node phase failed, exit 3):

- The image is **not bare**. Node 22 at `/opt/node22/bin/node`, Docker present at
  `/usr/bin/docker`, and a global npm tree already holding `pnpm@10.33.0`, `eslint@10.1.0`,
  `typescript@6.0.2`, `playwright@1.56.1`, `chromedriver`, `yarn`, `prettier`, `ts-node`.
  Provisioning is therefore *displacement*, not installation — the repo's pinned versions must
  win over the image's, and the image's `/opt/node22/bin` may sit ahead of `/usr/local/bin` on a
  session's PATH.
- **Docker is present on this image.** The Postgres branch will take the compose path
  (see [Two Postgres paths](05-two-postgres-paths.md)), which means the native-cluster branch
  still has no exerciser anywhere.
- **nvm is unusable here.** Sourcing `nvm.sh` into a `set -euo pipefail` script exited 3 and took
  the provision with it, without tripping the ERR trap. Replaced by the official Node tarball.
- The ERR trap did not fire, because a *sourced* script that exits does not trip ERR. An EXIT
  trap was added to cover every route out.

Every phase after `node` is still unproven on a cloud machine.

## What to do

On a fresh cloud sandbox, from the bootstrap in the setup field through to a working session:

1. `scripts/provision.sh` cold. Capture full output and wall-clock, per phase if it fails.
2. Then, by hand, each leg the script claims: `pnpm verify` (five stages), `pnpm test:db`,
   `pnpm dev` answering HTTP on :3210.
3. Re-run `provision.sh` on the now-provisioned machine — idempotency is a claim too.
4. Record the ambient facts a session cannot see but is affected by: `NODE_ENV` and the rest of
   the inherited environment, Docker daemon present or not, system Python, Node on `PATH` before
   and after, which Postgres path was taken, listener ownership of 5544, git identity, whether
   egress is open at provision time and still open later.

## Exit criteria

- [ ] A cold run performed on a genuinely empty container, its output and timings recorded in
      this ticket's `## Resolution`.
- [ ] Each of the three claimed legs run by hand, pass or fail recorded — a failure here is a
      *result*, not a blocker to closing.
- [ ] The idempotent re-run performed and its behaviour recorded.
- [ ] The ambient-fact list above written down as facts, with local values beside cloud values
      wherever they differ.
- [ ] Any fault that stops the run outright fixed in `scripts/provision.sh` and the cold run
      repeated on a *new* container — a fix verified on the machine it was made on proves nothing.
- [ ] New traps appended to `docs/TRAPS.md` only where the fault is environmental and cannot be
      mechanised; anything mechanisable is handed to `pnpm doctor` instead.

## Guardrails

- Do not fix by hand in the container and call it provisioned. Every fix lands in the repo, and
  the proof is a *new* empty machine.
- Do not weaken the parity bar because a leg is inconvenient in a sandbox. A failing leg is
  recorded as a fact and handed to a later ticket.
- `NODE_ENV` is never set to work around anything (TRAPS, "Next.js and the build").
- The map's Out of scope holds: this is a dev workspace, not a deployment rehearsal.

## Resolution

**Ruling: the provisioner's cold path works end to end, including the native-Postgres branch
that had never been exercised. All three claimed legs pass. The two faults found are silent
ones, not stoppers, so per this ticket's own contract they are recorded as facts and handed on
— nothing was fixed here.**

Run on a cloud sandbox, 2026-08-12, container booted 10:17 UTC. The cold run was performed by
the setup field at boot; the legs, the re-run and the ambient survey were performed by hand in
the session that followed. 4 vCPU, 15 GiB RAM, 29 GiB free disk.

### The cold run

`scripts/provision.sh` at commit `89c3f6c` completed on a container that started empty.
Its transcript is **not recoverable** — the cloud setup field's output is not written to any
file on the machine (searched `/root/.claude`, `/var/log`, `/tmp`) and is not visible from
inside the session. This is itself a fact: *a cold run's output cannot be read by the session
that inherits the machine.* The run was therefore reconstructed from artefact mtimes, which
are unambiguous about order and duration:

| 10:18:00 | Node 24 unpacked to `/usr/local/lib/nodejs` |
| 10:18:07 | Postgres up, `.env` written, `.data/artifacts` created |
| 10:18:19 | `pnpm install` complete (~12s — the image carries a warm pnpm store) |
| 10:18:21 | `cad/.venv` synced by uv |
| —        | `db:migrate` landed 18 tables + `__migrations` |

**Total ≈ 25s from empty to migrated**, wall-clock, with egress open. Exit status was success:
the session started, which it would not have had the setup field failed.

Verified end state rather than trusting the timeline: 18 tables in `public` (`tenants`,
`projects`, `register_objects`, `drawing_revisions`, `acts`, …), roles `vextrus`,
`vextrus_app`, `vextrus_auth` all present.

### The three claimed legs — all pass

Run by hand, the first time this closing line has ever been checked:

| Leg | Result | Wall-clock |
|---|---|---|
| `pnpm verify` | **green**, 5/5 stages | 41.5s (typecheck 8.0 · lint 2.6 · test 5.3 · ruff 0.0 · cad:test 1.1 · build 24.4); 109 tests |
| `pnpm test:db` | **green**, 46 tests / 6 files | 9.0s |
| `pnpm dev` | **serves**: ready in 430ms, `GET /` → 200, `GET /login` → 200 | 4.2s first compile |

Verify's 41.5s is inside ADR-0007's <60s target on a cloud box, with the build stage included.
That was measured at 15.2s locally ([The build regression check](01-build-in-the-verify-contract.md));
it is **24.4s here** — the same stage, 60% slower on this hardware. The target holds, but the
headroom is smaller than the local number suggests.

### The idempotent re-run

`bash scripts/provision.sh` on the now-provisioned machine: **exit 0 in 8.7s**, migrate reported
`up to date`, `.env` left alone, cluster left running. Idempotent in effect — but see Fault B.

### Fault A — a session does not get the Node the provisioner installed

The provisioner applies three PATH treatments (profile.d, `.bashrc`, `/usr/local/bin` symlinks)
and all three are correctly in place. **None of them reaches the session**, because the
container's own environment puts `/opt/node22/bin` at PATH position 4 and `/usr/local/bin` at
position 10. A session's shell inherits that environment; it is neither a login shell nor an
interactive one, so it reads neither file, and the symlink treatment loses on ordering.

| Shell | node | from |
|---|---|---|
| session (ambient) | **v22.22.2** | `/opt/node22/bin/node` |
| bare `sh -c` | **v22.22.2** | `/opt/node22/bin/node` |
| `bash -lc` (login) | v24.19.0 | `/usr/local/lib/nodejs/…` |
| `bash -ic` (interactive) | v24.19.0 | `/usr/local/lib/nodejs/…` |

Consequence: every `pnpm` call in a session prints
`WARN Unsupported engine: wanted: {"node":">=24"} (current: {"node":"v22.22.2"})`, and the
engine pin in `package.json` is violated on every command. It is a warning, never a block.

Measured both ways, so the cost is known rather than feared: **verify is green on Node 22 and
on Node 24.** 41.5s on 22, **34.1s on 24** — 18% slower on the wrong Node, correct on both.
So this is a parity breach and a silent-drift risk, not a correctness failure today.

The provisioner cannot see this fault, because it `export`s the Node 24 path into *its own*
shell before its final check — so it measures 24 and reports success while the session that
inherits the machine gets 22.

### Fault B — the re-run re-downloads Node every time

The guard is `if [ "$(node_major)" -lt 24 ]`, evaluated against *ambient* `node` — which is
Node 22 for exactly the reason in Fault A. So a re-run on a fully provisioned machine
re-resolves the dist index, re-downloads the tarball and re-untars it, every time:

```
provision: user=root node=/opt/node22/bin/node docker=/usr/bin/docker
provision: installing Node v24.19.0 (x64) from nodejs.org     # already installed
```

Harmless today at 8.7s with egress open. The real hazard is that it makes **every re-run
depend on network egress** to redo work already done — so "re-running is the repair", the
script's own claim, fails on a machine whose egress has since closed. The two faults share one
root cause: the script asks *what node is on PATH* where it means *what node did I install*.

### Ambient facts — cloud beside local

| Fact | This cloud sandbox | Notes |
|---|---|---|
| user / `HOME` / `PWD` | root · `/root` · `/home/user/vextrus` | `$HOME` is not the checkout |
| `NODE_ENV` | **unset** | correct; the 2026-08-12 fault did not recur |
| Node on PATH | v22.22.2 before *and after* provisioning | Fault A |
| pnpm on PATH | 9.15.1 at `/opt/node22/bin/pnpm` | matches `packageManager` **by luck** — a prior image carried 10.33.0 |
| Docker | binary at `/usr/bin/docker`, **no daemon**, no `/var/run/docker.sock` | see below |
| Postgres | **16, pre-installed in the image**, cluster `16/main` on 5544, listening `127.0.0.1:5544` only | provision did not apt-install it |
| System Python | 3.11.15 | below cad's `>=3.13`; uv fetches its own — as designed |
| uv | 0.8.17 at `/root/.local/bin/uv` | |
| Egress | open at provision time **and** still open in-session (nodejs.org, npmjs, pypi all 200) | |
| localhost + proxy | `HTTPS_PROXY` set, but `no_proxy` covers `localhost`/`127.0.0.1` | probing your own dev server needs no special flag |
| git identity | `Claude <noreply@anthropic.com>`, ssh-signed via `/tmp/code-sign`, `commit.gpgsign=true` | `signingkey` points at `/home/claude/.ssh/…` — a path that does not exist under `HOME=/root` |
| Disk / CPU / RAM | 29 GiB free · 4 vCPU · 15 GiB | |

**The Docker fact overturns a premise of this map.** [Two Postgres paths](05-two-postgres-paths.md)
was written expecting the compose branch here, because a previous image had Docker at
`/usr/bin/docker`. It still does — *and the daemon is not running*. A `command -v docker` probe
would have taken the compose path and hung; `docker info` correctly fell through to native.
The presence of the binary says nothing about the availability of the daemon, and the
provisioner already gets this right. This run is the **first exercise of the native-cluster
branch anywhere**, and it works — including `test:db`'s 46 tests against it.

### Exit criteria

- [x] Cold run on a genuinely empty container — performed at boot; timings recorded, transcript
      unrecoverable (recorded as a fact).
- [x] Three claimed legs run by hand — all pass, recorded with timings.
- [x] Idempotent re-run performed — exit 0 in 8.7s; Fault B recorded.
- [x] Ambient facts written down, cloud beside local where they differ.
- [x] No fault stopped the run, so nothing was fixed in `scripts/provision.sh` and no repeat on a
      new container was owed. Faults A and B are silent, and this ticket's contract hands silent
      faults on: *"a failing leg is recorded as a fact and handed to a later ticket."*
- [x] One trap appended to `docs/TRAPS.md` (Docker binary ≠ Docker daemon — environmental, not
      mechanisable). Faults A and B are both mechanisable and go to
      [The provisioner earns its ok](04-the-provisioner-earns-its-ok.md) and
      [pnpm doctor](03-pnpm-doctor.md) rather than into prose.

### The alternative put and rejected

**Fix Fault A here, in the session that found it.** Rejected on this ticket's own guardrail: a
fix verified on the machine it was made on proves nothing, and the fix is not obvious — pinning
a session's PATH means either winning against a container-set environment variable the repo does
not own, or deciding that verify should *fail* on the wrong Node instead of warning. That is a
decision, not a patch, and it belongs to
[The provisioner earns its ok](04-the-provisioner-earns-its-ok.md), which now has a measured
fault to design against instead of a hypothesis.
