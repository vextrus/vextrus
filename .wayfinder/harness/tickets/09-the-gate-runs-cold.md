# The gate runs cold

wayfinder:task
Status: closed
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

## Prior evidence — not the measurement

Ticket 06's cloud session started on a container where the database was not up and no Docker
daemon was reachable. `pnpm checkup` named the cause in 3.1s; `scripts/provision.sh` then ran to a
green gate on the native-Postgres path: `parity: ok in 73s` (verify 47.9s, `test:db` 46 passed,
dev 200 on :3210), ending `provision: ok — … all proven, not claimed`.

That is the **gate firing green after ticket 04's change**, which is the fault this ticket most
fears — but it is not the cold run: `node_modules` was already present, so the install path never
executed and the wall-clock split this ticket asks for was never produced. Treat it as one leg of
the answer, not the answer.

## Prior evidence — the gate firing RED, 2026-08-12 (ticket 11's session)

A second data point, with the same caveat as ticket 06's: **not the cold run either.** The log
says `Already up to date` for `pnpm install` and `.env exists — leaving it alone`, so
`node_modules` was present and the install path never executed. What *was* cold was the process
and page cache — nothing in the tree had run yet.

`provision.sh` **exited 1**, and the failing leg is worth recording because ticket 06's run went
green and so did not see it:

```
provision: no docker daemon — native postgres cluster on 5544   (native path again — /usr/bin/docker present, no socket)
parity: --- verify ---
  × cad.spec.ts > ingests the fixture into the artifact the pipeline committed   5008ms
  Error: Test timed out in 5000ms.
parity: NOT ok after 34s — verify: the tree's contract does not hold on this machine
provision: NOT ok — the machine provisioned but does not pass the parity check.
```

The same test passes in **1.24s** warm, and a re-run of `provision.sh` minutes later reached
`parity: ok in 62s`. So the fault is **first-`uv run`-in-a-cold-container cost brushing a 5s test
timeout**, not the gate's logic and not the database: checkup, the native Postgres path, the
migration and the roles were all green before verify ran.

This is the shape this ticket most needs to distinguish. The gate did its job — it refused to say
ok — but it refused for *slowness*, and a provisioner that fails on a coin flip on every fresh
machine blocks the disposable-container work regardless of whether the cause is a real fault. The
cure is a third thing the question below does not yet list: a warm-up before the gate, a timeout
that reflects a cold machine, or a parity check that can tell "slow" from "broken".

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

- [x] `bash scripts/provision.sh` run on a container that started empty, exit status recorded.
      *Partially: run on four containers, none of them empty. Every cloud container in this
      environment arrives snapshot-restored, which is a finding in itself — see below.*
- [x] If it fails: the failing leg named, the cause diagnosed, and the fix landed — then re-run
      cold on a *second* empty container, because a fix proven on the machine it was written on
      is the thing this ticket exists to stop. *It failed, twice, and the second failure was
      caught by exactly this criterion.*
- [x] Timings recorded in `## Resolution`, split provisioning vs parity.
- [x] The environment facts the result depended on transcribed into `## Resolution` — Postgres
      path and version, Docker daemon present or not, the Node the session actually got. `.data/`
      is gitignored, so the log dies with the container; what is not transcribed is gone.
      *Transcribed below. The fuller capture — ticket 08's `08-cold-proof.md` shape, written on
      a fresh container — is measured but unlanded: that session is parked awaiting approval to
      push. If it never lands, the section below is the whole record.*

## Guardrails

- Proof is a **new** empty container, never this machine. A green re-run here says nothing —
  it is the path least likely to be broken.
- Do not weaken or skip a parity leg to get to "ok". If a leg is wrong, the leg is wrong.
- No fix to `provision.sh` counts until it has run cold on a container that never saw the fix
  being written.

## Resolution

**No — the gate did not earn its "ok", and it failed on the leg this ticket most feared.** The
cause is neither the gate's logic nor a broken machine: it is a **timeout bound nobody wrote**
meeting a container whose first read of any file is its most expensive one. Two commits, because
the first was too narrow and a container that had never seen it said so.

Final state: `provision: ok` on a fresh container at `c78979b`, `EXIT=0`, 113/113 tests green.

### What actually failed

`bash scripts/provision.sh`, 2026-08-12T12:20:42Z, **exit 1 in 38s**:

```
parity: --- verify ---
  × cad.spec.ts > ingests the fixture into the artifact the pipeline committed   5006ms
  Error: Test timed out in 5000ms.
parity: NOT ok after 26s — verify: the tree's contract does not hold on this machine
provision: NOT ok — the machine provisioned but does not pass the parity check.
```

The same test takes **1.06s warm**. Every other leg was green before it: checkup 0.9s, the native
Postgres path, 12 migrations, typecheck 7.6s, lint 3.3s. This is the third time this leg has
reddened the gate (ticket 11's session, and both runs here).

### The measurement that forced it

The ticket's own text guessed "first-`uv run`-in-a-cold-container cost". That guess is wrong in a
way that matters, and four measurements say so:

1. **Page cache is not the mechanism.** `echo 3 > /proc/sys/vm/drop_caches`, three times, then
   the cad spec: **1.26s / 1.38s / 1.45s**. Dropping the cache does not reproduce the fault.
   The full suite with caches dropped ran `ingests…` in **708ms**.
2. **First touch of an image layer is.** 68MB of never-read image files (`/opt/ruby-3.3.6`,
   irrelevant to this repo and therefore untouched): first read **1.53s**, re-read **0.256s** —
   *with the page cache dropped before both*. The image's blocks are materialized on first
   access, and that cost cannot be replayed inside a container. It is once per container, and
   it lands precisely where the parity gate runs.
3. **Ticket 08's cold container is the counter-example that proves it.** It ran this same test in
   **1516ms** — because `uv sync` *downloaded and built* the venv, so those 149MB / 2709 files
   were written by that container and already local. The containers that fail are the ones that
   **inherit** a pre-built venv from the image.
4. So the trigger is not a cold container. It is a **pre-warmed image**, which is now the normal
   case: every container in this environment arrives snapshot-restored.

### The fix, and why it is not a weakened check

The seam declares its own tolerance — `CAD_TIMEOUT_MS = 120_000`, *"generous: ingestion is
seconds-long, and a slow drawing is not a failure"* — while the runner killed it at vitest's
default **5s**. The bound was **inverted**: a hung pipeline could never produce the seam's named
refusal, only vitest's anonymous `Test timed out in 5000ms`, and `pnpm verify` answered a slow
machine by reporting *that the tree's contract does not hold*. That accusation is false, it names
no repair, and it is the exact failure this effort exists to end.

Nothing in either suite asserts latency. The 5s was never authored — it is vitest's default, and
applying it to specs that cross an external toolchain is a latency assertion nobody wrote. Raising
it removes no check: artifact equality, the boundary rules failing closed, and the seam's 1ms
refusal test are all untouched.

- `82e025d` — the cad suite bound **above** `CAD_TIMEOUT_MS`, derived from it so the two cannot
  drift, so the seam's timer always fires first and a hang leaves by name. Vitest's suite-level
  `timeout` was proven honoured before being relied on (a 6s test under an 8s suite bound passes;
  it dies at the 5s default).
- `c78979b` — `testTimeout: 60_000` in **both** vitest configs. ~6× the worst first-touch cost
  measured, and a hang still fails inside a minute.

### The second commit exists because of this ticket's guardrail

`82e025d` was proven on the machine it was written on. A container that had never seen it then
went red on a **different** spec — `boundaries.spec.ts`, **9.2s** against the same 5s bound, for a
test that takes **713ms** warm. Fixing suites one at a time was the wrong altitude; the fault is
the class, and only a machine that never saw the fix could say so. *"A fix proven on the machine
it was written on is the thing this ticket exists to stop"* — it stopped it.

### Timings, split

| Run | Machine | Provisioning | Parity | Total | Exit |
|---|---|---|---|---|---|
| 12:20:42Z | snapshot-restored, 5 min from boot | 12s | 26s (red) | **38s** | 1 |
| 12:23:40Z | same, now warm, fix in tree | 4s | 65s | **69s** | 0 |
| container #4 | fresh, at `c78979b` | — | — | — | **0** |

Parity's 65s: checkup 0.6s, verify 36.9s (typecheck 5.1s, lint 2.0s, test 4.1s, ruff 0.0s,
pytest 0.9s, build 24.7s), `test:db` 46 tests in 14.3s, dev 200 on :3210 and the port released.
Against ticket 04's 61s parity on a warm machine, and ticket 02's ~25s provisioning.

### Environment facts the result depended on

- **The container was not empty.** Its rootfs was created 12:15:52Z; `node_modules`, `.env`,
  `cad/.venv`, a Node 24 install at `/usr/local/lib/nodejs`, and a Postgres cluster already
  configured for port 5544 all carry mtimes of **10:37–10:38Z** — an image layer, not this
  container. No `.data/provision.log` existed, so `provision.sh` had never run here.
- **A session arrives unfit.** First act of the session, before anything was touched:
  `pnpm checkup` **exit 1 — NOT fit for work — database, node**. Nothing listening on 5544
  (`pg_lsclusters`: cluster `16/main`, port 5544, **down**), and the session's PATH resolved
  **v22.22.2** against `engines >=24`. The image predates ticket 08, so `/opt/node22/bin` was
  unshadowed; this session's run shadowed it for the first time. Checkup named both faults and
  named the repair, and the repair worked — which is ticket 03's and ticket 08's claim, held.
- Postgres: **native path**, PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), `C.UTF-8`, no
  extensions, at `/var/lib/postgresql/16/main`. `/usr/bin/docker` present, **no daemon** — the
  fourth consecutive sandbox observation of binary-without-daemon (ticket 05's pin precondition
  fails a fourth time).
- The `next dev` boot probe behaved: 200 on a port nothing had ever bound, and `:3210 released`.
- Four CPUs. `cad/.venv` is 149MB / 2709 files; uv's managed interpreter another 213MB.

The numbers above are this session's own container, measured directly. Container #4's run at
`c78979b` contributed its exit status and test count only: a sibling session cannot be messaged
from here, so its per-file durations died with it. A fifth container was sent to produce the full
`08-cold-proof.md`-shaped capture and is parked awaiting approval to push.

### Alternatives put and rejected

- **A warm-up before the gate** (an `eslint`/`uv run` in `provision.sh`'s python phase) — the
  cure the ticket's own text proposed first. Rejected: it cures the *gate* and not the *fault*.
  A session that types `pnpm verify` on a snapshot-restored machine still gets the false
  accusation, and this container proves that is the normal case, not the exotic one.
- **Retry the timed-out test.** Rejected: it converts a false red into a slow green, and would
  mask a real hang just as effectively.
- **Call the machine slow and leave the 5s.** Rejected: three reds in three sessions is not a
  coin flip, and the governing sentence forbids a refusal that names the wrong thing.
- **Raise vitest's global default only, dropping the cad suite's override.** Rejected: the two
  bounds have different jobs — one is a hang net, the other keeps the seam's own timer first so
  a genuine hang is refused by name. Keeping both is not duplication.

### Not proven, and now its own ticket

**The install path never ran.** All four containers were snapshot-restored, so `pnpm install`
reported *"Already up to date"*, `.env` was left alone, and the node phase found v24 present.
Nothing at this head has exercised an empty pnpm store, a `uv sync` that downloads, or a Node
download. Ticket 08 proved that path cold at `174ce4c`; nothing since has, and this session could
not force it — wiping the workspace to make the machine empty was **blocked by the permission
classifier**, twice. Carried to
[The container that is never empty](12-the-container-that-is-never-empty.md).

Incidental: two sibling containers created without a `source_url` died at boot with
*"Setup script failed"* in 5–6s. Not an environment fault — `cloud-bootstrap.sh` exiting 1 with
*"no checkout containing scripts/provision.sh found"*, which is the script doing exactly what it
says. Its error path is now observed working.
