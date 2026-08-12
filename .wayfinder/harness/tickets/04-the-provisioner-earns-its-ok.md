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
