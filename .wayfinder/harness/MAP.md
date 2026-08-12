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
  **Amended by ticket 09: a cloud container does not start empty.** It arrives snapshot-restored
  — a photograph of a machine some earlier session already provisioned, taken at a commit that
  may predate the current head. So it is unfit on arrival (database down, and on today's image
  Node 22), the install path is skipped as "already up to date", and disposability buys a fresh
  *process tree*, not a fresh *disk*.
- **A container's first read of a file is its most expensive one.** Image blocks are materialized
  on first access: 68MB of never-touched image files read in 1.53s, then 0.26s on re-read *with
  the page cache dropped before both*. It is not page cache, it cannot be replayed inside one
  container, and it lands exactly where the parity gate runs. Any bound a spec crosses on first
  touch will fail there and nowhere else (ticket 09).
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

- 2026-08-12 — [Two Postgres paths](tickets/05-two-postgres-paths.md) — **both survive**; the pin
  failed its precondition (three sandbox observations: present, binary-no-daemon,
  binary-no-daemon). The exerciser worry *inverted* — native runs every cloud session, compose
  every local one. Equivalence is **five properties** gated by a new `pg profile` line in
  `pnpm checkup`: major 16, UTF8, `C.UTF-8` collate/ctype, no extensions beyond `plpgsql`, plus
  the roles line already there. The one real divergence was **locale** — native `C.UTF-8` vs the
  image's `en_US.utf8` — now **pinned to `C.UTF-8` on both** (`POSTGRES_INITDB_ARGS`; native
  `CREATE DATABASE ... TEMPLATE template0`), costing one `docker compose down -v` locally.
  Collation turned out **inert today** (ordinals sort in JS; no SQL orders by text), which is why
  it is pinned rather than watched. A `.dbspec.ts` test was rejected: checkup is about the
  machine, tests are about the tree. verify green **51.2s**.
- 2026-08-12 — [What a cloud session owns](tickets/06-what-a-cloud-session-owns.md) — **ADR-0010**:
  the dispatcher owns branch, ticket, claim and merge; the session owns the work and the evidence.
  The prior lost both halves. *Merge is a human act on your machine* was refuted by `main`'s own
  history — PR #1 squash-landed through the button — and rescued by arithmetic instead: a squash of
  a branch containing `main`'s tip yields a tree byte-identical to the one verify ran on, so
  fetch → **merge** → `pnpm verify` → push → SHA-stamped evidence comment, then the human clicks.
  *The claim is pushed as its own commit* failed on visibility — a claim on a session branch is
  invisible on `main` (this session proved it, `ce001b9`), so the **dispatcher** picks the ticket
  and claims. The loop differs by unit, not rule: the arc directory is the campaign's alone. Not
  mechanically enforceable — "require up to date" is a sub-option of required status checks, and
  there is no CI; CI is the named seam that would take the weight. **Not yet exercised with two
  concurrent sessions**; deferral and its three watch-fors are named in the resolution. Its own
  merge hit watch-for (1) immediately: ticket 07 landed on `main` mid-session and both entries
  collided here. Resolved by keeping both.
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
- 2026-08-12 — [The locale in the sort](tickets/11-the-locale-in-the-sort.md) — **code units
  behind one comparator** (`compareCanonical`, `src/core/order.ts`) at **all thirteen** sites,
  plus an absolute eslint ban on bare `localeCompare` proven to fail closed in
  `boundaries.spec.ts`. Forced by a reproduced flip: a mark family spelled `C1`/`c1` freezes
  `c1#1, C1#2` under ICU and `C1#1, c1#2` under code units — ordinals *and* the registered
  spelling. The ticket's headline axis was wrong: `LANG` only moves non-ASCII, while **case**
  moves plain ASCII, so the live axis is how Node was built (full/small/no ICU), not `LANG`.
  `Intl.Collator` with a pinned locale rejected — it closes one axis and leaves ICU version and
  build open. Nothing renumbered: `register_objects` was empty, and the suite passed unmodified.
  verify green **36.6s**.
- 2026-08-12 — [The provisioner knows what it installed](tickets/08-the-provisioner-knows-what-it-installed.md)
  — **correct, then detect, then enforce.** The repo wins the PATH fight by *shadowing*: walk the
  session's PATH, point any older `node`/`npm`/`npx`/`corepack` ahead of ours at ours, displaced
  binary moved to `<name>.vextrus-displaced`, hard-fail on a shadow it cannot apply. Walked, not
  hardcoded — `/opt/node22` is a fact about one image. "Provisioned" is a **probe of the install
  directory, never a marker**; the treatments moved out of the install branch, so a machine with
  Node 24 unpacked but unshadowed is now repairable by a re-run. The pin gets teeth: `verify`
  exits 1 below `engines` before stage one, `checkup`'s node line NOTE → BROKEN. Proven on a
  **cold empty container at `174ce4c`** — parity ok 52s, ~71s total, profile-free shell resolves
  v24, **zero `Unsupported engine`** anywhere ([capture](tickets/08-cold-proof.md)). Egress-blocked
  re-run exit 0 in 52s with no download — but blocked by shim, not packet filter. verify **27.9s**
  (43.5s on Node 22), **33.1s** after merging `main`. Ticket 07's fold-in shipped too: checkup
  gains an `environment` line under a new **`INFO`** mark — timestamp, platform, node, and the
  Postgres path *measured by provision.sh's own predicate* rather than inferred from `version()`.
  INFO cannot gate, because the verdict counts BROKEN only.

- 2026-08-12 — [The gate runs cold](tickets/09-the-gate-runs-cold.md) — **the gate refused, and it
  refused for the wrong reason.** `provision.sh` exit 1 in 38s: `cad.spec` timed out at 5006ms
  against a test that takes 1.06s warm, and `verify` answered by reporting *the tree's contract
  does not hold on this machine* — a false accusation naming no repair. The ticket's own guess
  (cold page cache) is **disproven**: `drop_caches` three times reproduces nothing (1.26–1.45s).
  The mechanism is **first-touch materialization of image blocks**, once per container — and
  ticket 08's cold container is the counter-example that proves it, running the same test in
  1516ms because it *built* the venv itself instead of inheriting one. So the trigger is a
  **pre-warmed image, not a cold container**. Cured at the class, not the suite: vitest's default
  5s is a latency assertion nobody wrote, raised to a 60s hang net in both configs, with the cad
  suite bound above `CAD_TIMEOUT_MS` so a real hang leaves by name. **The first fix was too narrow
  and a container that had never seen it said so** — `boundaries.spec` red at 9.2s — which is this
  ticket's guardrail doing precisely its job. Green at `c78979b` on a fresh container, EXIT=0.
  Rejected: a warm-up before the gate (cures the gate, not the fault), a retry (a false red
  becomes a slow green), and calling the machine slow. **No container was ever empty** — the
  install path is still unrun, carried to
  [the container that is never empty](tickets/12-the-container-that-is-never-empty.md).

## Not yet specified

- Whether CI exists at all yet, and what it runs — ADR-0007 refers `test:db` and Playwright to a
  "CI" that does not exist (`.github/workflows` is absent). Sharpened by the possibility that the
  cloud sandbox *is* that lane rather than a thing beside it. Sharpened again by ticket 07: the
  **Linux-native check is already written** — `pnpm parity`, which every cloud session runs — so
  what CI supplies is not a script but a *trigger*, and the absence of any invoker is what
  disqualified every per-commit capability from being charted. And by ticket 06: CI is the named
  seam that would make the merge gate mechanical — until it exists, "verify ran on this head" is a
  human-read claim and "branch up to date" is unenforceable, since GitHub offers that setting only
  as a sub-option of required status checks. Two tickets now converge on one trigger.
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
- Provisioning wall-clock as a target rather than a consequence. Now measured end to end with the
  parity gate in place: **~71s cold** (of which parity is 52s), **52s re-run with egress blocked
  and no download** (ticket 08). The re-download is gone, so the two cases are finally close, and
  what remains unstated is the *target* — and whether 52s of parity on every re-run is the right
  price for "re-running is the repair".
- A **packet-level** egress proof. Ticket 08's block was `curl`/`wget` shims, because the
  permission classifier declined `iptables`; that proves the provisioner makes no outbound call,
  not that nothing on the machine could. Sharpened by what it would take to block egress in a
  container whose own agent proxy sits on loopback.
- **A natively-started Postgres does not survive the container's process tree restarting.** The
  cold container of ticket 08 was green through provisioning and 46 `test:db` tests, then had no
  listener on 5544 six minutes later. `checkup` caught it and named the repair, so nothing is
  silent — but "re-run provision.sh" is a 52s parity gate to restart a database, and the compose
  path may not share the fault. What a session should do when the machine decays *after*
  provisioning is unspecified. **Ticket 09 makes this the arrival case, not the decay case**: a
  snapshot-restored container starts with the cluster already down, so every session meets it
  before doing any work. Fourth consecutive observation of docker-binary-without-daemon; partly
  carried by [ticket 12](tickets/12-the-container-that-is-never-empty.md).
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
