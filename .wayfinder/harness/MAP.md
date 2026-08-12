# Harness — the environment as the quality lever

## Destination

A session behaves identically wherever it runs — this Windows checkout, a cloud sandbox, CI —
and the workspace answers a session's questions mechanically instead of in prose. Provisioning
lives in the repo, is proven from an empty machine, and the verification contract says the same
thing everywhere. ADR-0007 is the law; this effort is where amendments to it are worked.

Two axes, deliberately one map because they collide at every step:

- **Parity** — same behaviour on every machine.
- **Legibility** — the workspace reports on itself, so a confused session measures instead of
  recalling a trap.

## Notes

- `scripts/provision.sh` is the single provisioner. The cloud "Setup script" field holds only
  a bootstrap that locates the checkout and execs it, so the real thing is versioned, diffable,
  and fixable from inside a session instead of through a web form.
- Cloud images are not stable ground: two consecutive sessions differed in Docker availability
  and system Python. The provisioner must detect, never assume.
- **The cloud's value is not only capacity — it is disposability.** A container that started
  empty is the only place the provisioner's cold path, the native-Postgres branch, and
  "does this repo work for someone who just cloned it" can be honestly verified. This machine
  is already provisioned, so locally the only exercisable path is the idempotent re-run — the
  path least likely to be broken. Disposability is ranked first because it validates the rest.
- Every `docs/TRAPS.md` entry is a question the environment failed to answer cheaply. The
  standing preference is to retire traps from prose into mechanism, not to write more prose.

## Decisions so far

- 2026-08-12 — Provisioning is repo-owned (`scripts/provision.sh`); the cloud form is a
  bootstrap only. Forced by two failed setup runs whose fixes could not be made from a session.
- 2026-08-12 — [The build regression check](tickets/01-build-in-the-verify-contract.md) —
  `next build` is verify's fifth stage, cold into `.next-verify`, last. 6.7s → **15.2s**, inside
  ADR-0007's <60s target; CI rejected because there is no CI to put it in.
- 2026-08-12 — Charting: destination widened to two axes (parity + legibility); cloud parity's
  bar is verify + `test:db` + a dev server that serves, self-proven by the provisioner;
  legibility converges on one `pnpm doctor` rather than scattered error text.
- 2026-08-12 — [The cold machine](tickets/02-the-cold-machine.md) — the cold path **works**:
  empty container to migrated in ~25s, and all three claimed legs pass on cloud hardware
  (verify 41.5s, `test:db` 46 tests in 9.0s, `next dev` serving 200 on :3210). The
  **native-Postgres branch ran for the first time anywhere and passed** — the sandbox had the
  Docker binary but no daemon. Two silent faults found, neither a stopper: a session runs the
  image's Node 22, not the installed Node 24 (engine pin violated by warning only, green on
  both), and the re-run re-downloads Node every time. Both handed to
  [ticket 08](tickets/08-the-provisioner-knows-what-it-installed.md).

## Not yet specified

- Whether CI exists at all yet, and what it runs — ADR-0007 refers `test:db` and Playwright to a
  "CI" that does not exist (`.github/workflows` is absent). Sharpened by the possibility that the
  cloud sandbox *is* that lane rather than a thing beside it.
- When the build stage stops being cheap (it grows with every route), what the contract does
  about it — re-measure, not relax, but the trigger is unstated.
- Secrets and git identity in a sandbox. `provision.sh` regenerates `BETTER_AUTH_SECRET` per
  run — fine for dev, unexamined for anything that outlives one container, and unexamined for
  what credential a session pushes with. Sharpened by ticket 02: commits are ssh-signed
  (`commit.gpgsign=true`, `gpg.ssh.program=/tmp/code-sign`) with `user.signingkey` pointing at
  `/home/claude/.ssh/…`, a path that does not exist under `HOME=/root`.
- Legibility past `pnpm doctor`: dev-server logs a session can read without owning a background
  shell, and error text at the failure sites themselves.
- Provisioning wall-clock as a target rather than a consequence — including what sandbox egress
  restrictions do to it. Ticket 02 supplies the first numbers (~25s cold, 8.7s re-run) but with
  egress open throughout, so the restricted case is still unmeasured — and the re-run's Node
  re-download means the two cases are not close.
- What a session is owed when it inherits a machine whose provisioning failed. The cloud setup
  field's transcript reaches no file, so the evidence a session would diagnose from does not
  survive the boot that produced it.

## Out of scope

- Playwright e2e placement (ADR-0007 already puts it outside the lane).
- Any change to what `verify`'s existing four stages check.
- **Production deployment.** This effort proves cold-start provisioning of a *dev workspace*;
  a deployment target is its own effort and must not be smuggled in through the provisioner.
  The shared property — clean checkout, nothing pre-warmed — stays in.
