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
  legibility converges on one workspace-check command rather than scattered error text.
- 2026-08-12 — [The cold machine](tickets/02-the-cold-machine.md) — the cold path **works**:
  empty container to migrated in ~25s, and all three claimed legs pass on cloud hardware
  (verify 41.5s, `test:db` 46 tests in 9.0s, `next dev` serving 200 on :3210). The
  **native-Postgres branch ran for the first time anywhere and passed** — the sandbox had the
  Docker binary but no daemon. Two silent faults found, neither a stopper: a session runs the
  image's Node 22, not the installed Node 24 (engine pin violated by warning only, green on
  both), and the re-run re-downloads Node every time. Both handed to
  [ticket 08](tickets/08-the-provisioner-knows-what-it-installed.md).
- 2026-08-12 — [`pnpm doctor` — what the workspace must report about itself](tickets/03-pnpm-doctor.md)
  — shipped as **`pnpm checkup`**: `doctor` is a pnpm built-in that shadows a package script of
  that name, printing nothing and exiting 0. Nine lines, each tracing to a trap that bit; **the exit code is the provisioner's, the output is the session's** — fit-for-work
  means verify, `test:db` and dev can all run, so a stopped database is unfit. 2s/probe,
  **1.3s** healthy. Not a verify stage; verify's *failure* path gains one inert pointer line.
  Storage root and system Python cut, git identity deferred to the secrets ticket. TRAPS: cut 1,
  trimmed 3, kept the three whose value is a cause or a signature. verify green **43.5s**.

- 2026-08-12 — [The provisioner earns its "ok"](tickets/04-the-provisioner-earns-its-ok.md) —
  `scripts/parity.sh` (`pnpm parity`), separate and callable, run by `provision.sh` as its last
  act: **checkup → verify → test:db → a `next dev` boot probed for 200 and killed**, fail-fast,
  no leg skippable. The legs run on the **session's PATH**, captured before the node phase — the
  provisioner reports Node 24 while parity reports the Node 22 a session actually gets, which is
  the blind spot ticket 02 warned would make this theatre. Re-run **9s → 71s** (parity 61s).
  `provision.sh` now tees to `.data/provision.log`, so a failed cold run leaves evidence. All
  four legs proven to fire. **Not yet run cold on a fresh container** — the one criterion left
  open.

- 2026-08-12 — [What a disposable machine makes possible](tickets/07-what-a-disposable-machine-makes-possible.md)
  — ranked by **staleness × invoker, severity breaking ties**; with no CI anywhere, a per-commit
  capability has no invoker and cannot be charted. Three candidates **collapsed into one act**
  (cold provisioning = migrate-from-empty = clean clone). Two promoted:
  [the gate runs cold](tickets/09-the-gate-runs-cold.md) first because it is stale *today* and
  everything else runs inside it, then [a migration meets rows](tickets/10-a-migration-meets-rows.md)
  — every migration this repo has run has met an **empty** database, and one that mangles register
  rows breaks identity stability *quietly*. Declined: the new-contributor path (a docs check),
  Linux-native behaviour (no invoker; already free on every cloud session — the gap is merge
  discipline), the loop (capacity, and no arc exists), drop-and-recover (it *is* the cold path),
  a seed corpus (rejected for `test:db`'s existing fixtures). Citability: the reproducer is a repo
  script, the result carries what varied, the Resolution is the archive — `.data/` is gitignored,
  so the log dies with the container. An environment fingerprint gives rule 2 a mechanism, folded
  into [ticket 08](tickets/08-the-provisioner-knows-what-it-installed.md); checkup now describes as
  well as judges, and descriptive lines never touch the exit code.

## Not yet specified

- Whether CI exists at all yet, and what it runs — ADR-0007 refers `test:db` and Playwright to a
  "CI" that does not exist (`.github/workflows` is absent). Sharpened by the possibility that the
  cloud sandbox *is* that lane rather than a thing beside it. Sharpened again by ticket 07: the
  **Linux-native check is already written** — `pnpm parity`, which every cloud session runs — so
  what CI supplies is not a script but a *trigger*, and the absence of any invoker is what
  disqualified every per-commit capability from being charted.
- When the build stage stops being cheap (it grows with every route), what the contract does
  about it — re-measure, not relax, but the trigger is unstated.
- Secrets and git identity in a sandbox. `provision.sh` regenerates `BETTER_AUTH_SECRET` per
  run — fine for dev, unexamined for anything that outlives one container, and unexamined for
  what credential a session pushes with. Sharpened by ticket 02: commits are ssh-signed
  (`commit.gpgsign=true`, `gpg.ssh.program=/tmp/code-sign`) with `user.signingkey` pointing at
  `/home/claude/.ssh/…`, a path that does not exist under `HOME=/root`. **Ticket 03 defers a
  checkup line to this patch**: git identity earns one, but not before something sets the standard
  it would assert.
- Legibility past `pnpm checkup`: dev-server logs a session can read without owning a
  background shell, and error text at the failure sites themselves — starting with
  `storageRoot()`, which ticket 03 ruled should own its own exists-and-writable check rather
  than hand it to checkup.
- Provisioning wall-clock as a target rather than a consequence — including what sandbox egress
  restrictions do to it. Ticket 02 supplies the first numbers (~25s cold, 8.7s re-run) but with
  egress open throughout, so the restricted case is still unmeasured — and the re-run's Node
  re-download means the two cases are not close.
- The loop's caps as measured numbers rather than inherited ones. `docs/specs/loop.md` marks
  `MAX_TURNS = 150` and the 30-minute wall fuse "re-derive, don't trust" — carried from a legacy
  environment whose verify was ~100s against our ~43s. Re-deriving needs a real campaign, and a
  campaign seizes a precious machine (the loop's preflight demands a clean tree, nothing on :3210,
  and a pre-push guard). A disposable container removes that objection for free — but there are
  **no arcs yet**, so this cannot be ticketed until one exists.

## Out of scope

- Playwright e2e placement (ADR-0007 already puts it outside the lane).
- Any change to what `verify`'s existing four stages check.
- **Production deployment.** This effort proves cold-start provisioning of a *dev workspace*;
  a deployment target is its own effort and must not be smuggled in through the provisioner.
  The shared property — clean checkout, nothing pre-warmed — stays in.
