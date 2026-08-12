# The provisioner earns its "ok"

wayfinder:task
Status: closed
Claimed by:
Blocked by: 03-pnpm-doctor.md

## Objective

Make `scripts/provision.sh` prove the thing it currently asserts. It ends by running the parity
check itself and exits non-zero if any leg fails.

## What forced it

The script's last line prints `provision: ok — pnpm verify | pnpm test:db | pnpm dev (:3210)`,
but its exit status only reflects `pnpm db:migrate`. A provisioner that says "ok" without
checking is how a session begins work on a broken machine and then blames the code — which is
exactly what happened when a sandbox's `NODE_ENV` broke `next build` while verify stayed green.

## The bar (settled while charting)

Verify alone was rejected: it is precisely the bar that let the `NODE_ENV` build bug through, and
a sandbox can pass verify while `pnpm dev` will not start and `test:db` cannot reach a database.
Playwright/browser was ruled out — ADR-0007 keeps e2e outside the lane and Chrome in a sandbox is
a large new surface.

So the check is: **`pnpm doctor`, then `pnpm verify` (five stages), then `pnpm test:db`, then a
`next dev` boot probed for HTTP 200 on :3210 and killed.** `test:db` is the leg that proves
Postgres is genuinely wired — roles, migrations, tenant seam — which is the part most likely to
differ between the compose path and the native-cluster path.

## What to decide while doing it

- Where the check lives: inline in `provision.sh`, or a separate script the provisioner calls and
  a human can also run alone. The prior is separate and callable — a check you cannot re-run
  without re-provisioning is a check you will stop running.
- Whether any leg is skippable, and if so how the skip is *reported* rather than silent. A
  sandbox with no way to bind :3210 is a real case; a silently skipped leg is not acceptable, a
  loudly reported one may be.
- The dev-server leg's mechanics: boot, probe, kill, and leave no listener behind. TRAPS is clear
  that a stray dev server is a second writer.

## Exit criteria

- [x] The check wired, and `provision.sh` exits non-zero when any leg fails.
- [x] Proven to fire on each leg: break each one deliberately (in turn, reverted) and confirm the
      provisioner reports which leg failed and exits non-zero.
- [ ] Run end to end on a fresh container — not only on an already-provisioned machine.
- [x] Wall-clock recorded, before and after, in `## Resolution`. The expected cost is roughly a
      verify plus a boot; if it is far more, say so rather than trimming the bar quietly.
- [x] No dev-server process or :3210 listener survives the run.
- [x] `pnpm verify` green, duration recorded.

## Guardrails

- The verify contract is not weakened to make provisioning faster — no caching, no skipped stage.
- The provisioner stays idempotent: re-running it is still the repair.
- Failing loudly is the point. Do not add a flag that makes it quiet by default; a session that
  cannot see a broken machine is the failure this ticket exists to end.

## Facts from [The cold machine](02-the-cold-machine.md) — 2026-08-12

All three legs were run by hand on a cold cloud sandbox and **all three pass**: verify green in
41.5s (build stage 24.4s — 60% slower than the 15.2s measured locally), `test:db` green in 9.0s,
`next dev` ready in 430ms answering 200 on `/` and `/login`. So the bar in this ticket costs
roughly **51s plus a boot** on cloud hardware, and the expected-cost line above can be written
against a measurement rather than a guess.

Two silent faults were found that this ticket's design must account for — neither stops a run,
so neither would be caught by wiring the legs alone:

- **A session does not run the Node the provisioner installed.** The container environment puts
  `/opt/node22/bin` ahead of `/usr/local/bin` on PATH, and a session's shell is neither a login
  nor an interactive shell, so all three of the provisioner's PATH treatments miss it. Result:
  Node 22 in every session, `WARN Unsupported engine: wanted {"node":">=24"}` on every pnpm
  call, warning only, never a block. Verify is green on both (41.5s on 22, 34.1s on 24).
  **The provisioner cannot currently detect this**, because it `export`s Node 24 into its own
  shell before its final check — so a parity check bolted onto this script would inherit the
  same blind spot and pass while the session is on the wrong Node. Whatever this ticket wires
  must run the legs in a shell resembling a *session's*, not the provisioner's.
- **A cold run's output is unreadable afterwards.** The cloud setup field's transcript is
  written to no file on the machine. When this ticket makes the provisioner exit non-zero on a
  failed leg, the *reason* still has to reach a session that starts on the broken machine — a
  log the provisioner writes itself, since the harness keeps none.

Fault A's cure and the re-download defect below are both mechanisable and are carried by
[The provisioner knows what it installed](08-the-provisioner-knows-what-it-installed.md).

## Resolution

2026-08-12. `scripts/parity.sh`, called by `provision.sh` as its last act. The script that used
to print `ok` while its exit status reflected only `db:migrate` now exits non-zero unless four
legs actually pass.

### Where the check lives

**A separate script the provisioner calls, also runnable alone as `pnpm parity`.** The ticket's
prior, and it held: a check you cannot re-run without re-provisioning is a check you will stop
running. Inline was rejected — re-running provisioning to re-test a machine costs a Node
download and a `pnpm install` to learn something the four legs answer directly.

### Order, and why fail-fast

`checkup` → `verify` → `test:db` → `next dev` boot. Cheapest-and-most-diagnostic first, and
that ordering is not cosmetic: with the cluster stopped, parity fails in **2s** naming the
database, instead of spending ~40s on verify to rediscover it. Ticket 03 defined checkup's exit
code as "fit for work" precisely so this could gate on it, and the two artifacts met as intended.

Notable checkup lines do not fail the run — the standing Node divergence reports and the
provisioner still earns its ok, which is what keeps the gate usable before ticket 08 lands.

### The legs run on a session's PATH, not the provisioner's

The fault ticket 02 warned about: `provision.sh` exports Node 24 into its own shell, so a check
bolted onto it inherits the same blind spot and passes while every session runs the image's Node
22. So `provision.sh` captures `PARITY_SESSION_PATH="$PATH"` **before** the node phase touches
it, and `parity.sh` runs the legs on that. Standing alone it inherits a session's shell already
and leaves PATH untouched.

Proven in the end-to-end log: the provisioner reports `node v24.19.0 at /usr/local/lib/nodejs/…`
and parity, three lines later, reports `node v22.22.2 at /opt/node22/bin/node`. The legs are
proven on the Node a session will actually run. Without this the whole check would have been
theatre.

### No leg is skippable

Considered and rejected: a skip for sandboxes that cannot bind :3210. The guardrail is explicit
that failing loudly is the point, and a skip flag is a thing that gets set once and never unset.
An occupied :3210 fails with its own message (`something is already listening … Stop it and
re-run`) rather than a generic boot failure, which is the "loudly reported" case the ticket
allowed for — it just reports as a failure rather than a pass.

### The dev leg's mechanics

Boot under `setsid` so the whole tree lands in one process group — `next dev` spawns children,
and killing only the pnpm shim orphans them holding the port. Poll `/` for a 200 up to 60s,
breaking early if the process dies rather than waiting out the timeout on a corpse. Teardown is
TERM to the group, then the pid, then KILL, and then **the port is re-probed**: a listener that
survives teardown fails the run. A stray dev server is a second writer (docs/TRAPS.md), so the
teardown is checked as carefully as the boot. Verified after every run in this ticket — no
listener, no `next-server` process.

### The provisioner keeps its own log

Ticket 02's fault B: a cold run's output is gone by the time a session can look, because the
cloud setup field's transcript reaches no file. `provision.sh` now tees everything to
`.data/provision.log` (append, never truncate — the failed run before the one that fixed it is
the interesting one). `.data/` is already gitignored. On failure the script names the log path.

### Cost

| | before | after |
|---|---|---|
| `provision.sh` re-run, this machine | ~9s | **71s** |
| of which parity | — | **61s** (checkup 2 · verify 39 · test:db 11 · dev boot ~9) |

Roughly a verify plus a boot, which is what the ticket predicted from ticket 02's measurements
(~51s plus a boot on cloud hardware). Not trimmed. The 71s still includes the Node re-download
defect ticket 08 carries — that is provisioning cost, not parity cost.

### Proven to fire on each leg

Each break deliberate and reverted; tree clean after each.

| Leg | Break | Result |
|---|---|---|
| checkup | `pg_ctlcluster 16 main stop` | `[BROKEN] database  nothing listening on localhost:5544`, exit 1 in **2s** |
| verify | a temporary `src/core/__parity_probe.ts` with a type error | `error TS2322`, exit 1 in 9s |
| test:db | a temporary failing `*.dbspec.ts` | `1 failed | 46 passed`, exit 1 in 50s — and it confirmed `*.dbspec.ts` is outside verify's lane, since verify passed on the way through |
| dev | a squatter listening on :3210 | `something is already listening on :3210 — cannot prove the boot`, exit 1 in 51s |

Each failure names its own leg; `provision.sh` suspends its generic ERR/EXIT reporting around the
call so the leg's message is not buried under `FAILED in phase 'parity'`.

### Verify

`pnpm verify` green in **36.4s** (typecheck 6.9 · lint 2.6 · test 4.9 · cad:ruff 0.0 · cad:test
0.9 · build 21.0). Unchanged — parity calls verify, never the reverse.

### Left open

**The fresh-container criterion is not met.** This machine is already provisioned, so only the
idempotent re-run was exercised — the path the map itself calls least likely to be broken. The
cold path with parity wired has never run. That is the one box left unticked, and it wants a
disposable container, not another session here.
