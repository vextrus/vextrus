# The provisioner earns its "ok"

wayfinder:task
Status: open
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

- [ ] The check wired, and `provision.sh` exits non-zero when any leg fails.
- [ ] Proven to fire on each leg: break each one deliberately (in turn, reverted) and confirm the
      provisioner reports which leg failed and exits non-zero.
- [ ] Run end to end on a fresh container — not only on an already-provisioned machine.
- [ ] Wall-clock recorded, before and after, in `## Resolution`. The expected cost is roughly a
      verify plus a boot; if it is far more, say so rather than trimming the bar quietly.
- [ ] No dev-server process or :3210 listener survives the run.
- [ ] `pnpm verify` green, duration recorded.

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
