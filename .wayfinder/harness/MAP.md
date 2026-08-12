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
  **Amended by ticket 09: there are two kinds of cloud container, and nothing announces which
  one you got.** A freshly created one *is* empty and provisions itself at boot — Node
  downloaded, cluster created, `parity: ok in 57s`, the install path genuinely exercised. A
  snapshot-restored one is a photograph of a machine an earlier session provisioned, at a commit
  that may predate the current head: unfit on arrival (database down, Node 22 against the pin),
  install path skipped as "already up to date". The only tell is file mtimes against `/`.
  **Closed by ticket 12, by routing rather than detection:** the setup field runs at container
  *creation* only and the platform caches the state afterwards, so a restore invokes nothing — a
  `SessionStart` hook now runs `checkup` before turn one, and the kind of container you got is a
  cause whose consequences checkup already names.
- **A container's first read of a file is its most expensive one.** Image blocks are materialized
  on first access: 68MB of never-touched image files read in 1.53s, then 0.26s on re-read *with
  the page cache dropped before both*. It is not page cache, it cannot be replayed inside one
  container, and it lands exactly where the parity gate runs. The size of the penalty is
  machine-dependent — worst on a container that inherits a 149MB venv it has never read, absent
  on one that built its own — so a bound it can cross fails unpredictably, on some machines and
  not others (ticket 09).
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
  becomes a slow green), and calling the machine slow. **The fifth container arrived genuinely
  empty** — provisioned itself at boot in ~83s, downloading Node and creating the cluster from
  nothing, `parity: ok in 57s`, so **the install path is proven at this head** (ticket 04's last
  open criterion). It also **did not reproduce the fault** — worst file 2315ms — which makes the
  cost machine-dependent rather than universal, and is the argument for a generous net rather
  than against it. Two kinds of container, indistinguishable on arrival:
  [ticket 12](tickets/12-two-kinds-of-container.md). Raw captures:
  [09-cold-proof.md](tickets/09-cold-proof.md).

- 2026-08-12 — [A migration meets rows](tickets/10-a-migration-meets-rows.md) — kept, as
  **`pnpm db:replay`**, and its first honest run found that **`0010` cannot be applied to a
  database with rows**: `ADD COLUMN "semantic" text NOT NULL`, no default, no backfill, fine
  against the empty table it has met on all twelve runs this repo has ever done, aborting against
  24 sightings. Not repaired — a landed migration is never edited and no database at `0009`
  with rows exists — but the next one cannot land unnoticed. The ticket's specified drill was
  killed three times over by measurement: **`test:db` leaves zero rows** (133 written, all
  deleted by the fixtures' own `afterAll`), the **head suite cannot run at N−1** (`0011` is the
  constraint `revision-delta.dbspec` needs), and **there is no tree at N−1** (twelve migrations,
  six commits, schema and RLS always paired). So the unit is the **commit**: baseline = the
  previous migration-bearing commit, populated by *its* `test:db` in a git worktree, its deleted
  rows restored by an `AFTER DELETE` archive and put back in foreign-key order — no fixture
  edited, nothing to keep in step, which is why it is not the rejected seed corpus. Exit code
  mechanical, row delta as output, the checkup split again. Last step is `db:drift`, not head's
  `test:db`: that measured fixture isolation and failed on it. Trigger: `CLAUDE.md`, pre-commit.
  verify green **39.2s**. [Captures](tickets/10-replay-proof.md).

- 2026-08-12 — [Two kinds of container](tickets/12-two-kinds-of-container.md) — **the subject was
  never the divergence; it was that nothing invokes the repair.** The closing session landed on the
  snapshot kind and measured it first: the *same* 10:37 image ticket 09 saw, four tickets later,
  no `provision.log`, Node v22.22.2 unshadowed. So the snapshot **never refreshes** and the setup
  field **does not fire on a restore** — it runs at container *creation*, after which the platform
  caches the state, which is what manufactures the second kind. Ruling: **route, don't label.** A
  `SessionStart` hook runs `node scripts/checkup.mjs --hook` before turn one and **reports, never
  repairs** — repair in a hook would mutate a machine on an arrival nobody chose and pay parity's
  61s in the least legible place there is. Output is proportional to the trouble: fit is **one
  line** (ticket 07's environment stamp, so every later number is citable), unfit is all nine plus
  the repair; **always exit 0**, because the exit code stays the provisioner's and this is the
  first consumer of the *output* half. A **container-kind line was rejected** — checkup already
  names every consequence by symptom, and the only tell is a mtime inference, which is exactly what
  "measured, never inferred" bans. Agent-only routing accepted. The loop takes the same gate as its
  **first** preflight (machine before tree, exit code, subsuming :3210). Wall-clock ruled a
  consequence, **no target** — an unwritten latency threshold is what ticket 09 just deleted.
  Proven by stopping Postgres for real: `--hook` EXIT=0 with the full report, bare checkup EXIT=1,
  `conduct.mjs` refusing in 1.1s naming the repair; repair `parity: ok in 101s`; fit line **1.4s**.

- 2026-08-12 — [CI — the missing trigger](tickets/13-ci-the-missing-trigger.md) — **CI is ruled:
  GitHub Actions, running the provisioner rather than a recipe of its own.** *This entry read as
  though the workflow existed; it did not. Corrected 2026-08-12 by ticket 15, which went looking
  for it and found `.github/` absent from the tree and from `main`, then **built it** —
  `.github/workflows/ci.yml`, one job, `provision.sh` only, the `db:replay` step held (debt below).
  **It goes green on a hosted runner: 77s, `parity: ok in 46s`, all four legs run.** The first run
  failed in 16s and paid for itself immediately: `corepack enable` was `|| true`, and a runner is
  the first **non-root** machine this provisioner has met, so the shim never landed, the cause went
  to `/dev/null`, and the script died two lines later on `pnpm: command not found` — a provisioner
  defect, exactly what this ruling said CI was for.* One job, two commands: checkout at `fetch-depth: 0` → `bash scripts/provision.sh` (whose last act *is*
  `parity.sh`, so this is checkup | verify | test:db | dev in full) → `pnpm db:replay`
  unconditionally, its no-new-migration skip pushed into the script. The workflow holds **no
  project knowledge** — no setup recipe, no service block, no stage list, no path filter — so it
  cannot drift from what a session runs. A workflow with its own setup was rejected as a **second
  provisioner**, the divergence this effort exists to kill. Triggers: `pull_request` → `main`,
  `push` on `main`, `workflow_dispatch`; no `schedule`, because an unread red is worse than no
  signal. The PR run becomes a **required check with require-up-to-date** — the sub-option that
  exists only once a required check does, which is why ADR-0010 could not have it; the `main` run
  is a **canary, never required**. The check unblocks the button, **the human still presses it**.
  **No timing budget**, forced by a 2.2× spread on one commit: verify **90.3s** at the machine's
  first touch of its own image vs **41.4s** warm, so any threshold sharp enough to catch route
  growth fires on a machine's history instead — the assertion ticket 09 deleted. What
  *"re-measure, not relax"* lacked was a **series**, not a threshold. Cost premise corrected: the
  repo is **public**, so runners are free and unmetered. **Playwright ruled a non-subject** — it
  exists nowhere but prose. Ticket 07's declines stay declined. **ADR-0010 amended**: the required
  check supersedes the evidence comment, *when the check exists*. Limitation named, not papered
  over: `ubuntu-latest` has Docker, so CI takes the **compose** path and the **native branch every
  cloud session runs still has no unattended exerciser** — fog below. Build handed to `/to-spec`.

- 2026-08-12 — [Legibility past `pnpm checkup`](tickets/14-legibility-past-checkup.md) — **the
  storage hole ticket 03 left was misdiagnosed, and the right check is cheaper than the one it
  asked for.** *Exists and writable* survives neither half: `writeArtifact`'s recursive `mkdir`
  **creates the root itself**, and an unwritable one already throws `EACCES` with the path. The
  unguarded thing is a third — **divergence between two roots that both work**: a stale
  `VEXTRUS_STORAGE_ROOT` writes perfectly to a second tree and surfaces days later as an `ENOENT`
  that reads like tampering, the same symptom the absolute-path rule exists to prevent, through
  another door. Ruled **identity, not liveness** — the root is a precondition, checked at the one
  boundary that creates directories, **no per-call `stat`**. Env preconditions turned out to be
  one concept implemented **four times**, two of them a verbatim-duplicated `requireEnv`, and the
  only two carrying `(see .env.example)` were the hand-written ones — unified into
  `src/core/env.ts`; a process-start env schema rejected as a second checkup living in the app.
  The ticket's other two suspects (`runCadIngest`, the tenant seam) came out **clean and were
  left alone**. The dev server got **`pnpm dev:bg`/`dev:stop`** — a second command, not a flag,
  because wrapping `pnpm dev` needs a shim between a human and Next's TTY that behaves alike on
  Windows and Linux, which is the divergence this effort exists to kill; `parity.sh`'s private
  arrangement made shared. **checkup absorbed nothing from those three** (each widens what
  fitness *means*; no parity leg touches storage) and **one line from the TRAPS pass**:
  `INFO provision — last run … · ok|failed|did not finish`, because a command that names
  `provision.sh` as the repair but cannot say whether it was ever attempted is the illegibility
  in question. TRAPS: **1 retired** (*a dev server is a second writer* — checkup emits that
  sentence verbatim), **2 trimmed to cause and signature**, **1 retired into the new line**,
  the rest kept. Net prose down; `CLAUDE.md` gained one line only because a command nobody knows
  exists is not a mechanism. verify green **31.2s**, `test:db` 46 in 12.6s, checkup **1.0s**.

- 2026-08-12 — [Secrets and git identity in a sandbox](tickets/15-secrets-and-git-identity.md) —
  **the provisioner invents nothing, nothing outlives a container, and ticket 03's deferred git
  line is discharged by refutation rather than shipped.** Two of the three faults the ticket was
  built on did not survive measurement. `head -c 32 /dev/urandom` is **deleted**: rotation was
  accepted first, then argued down to *don't generate at all*, because a random per-container
  secret is a variable nobody chose — no code reads it (better-auth reads the env var itself), it
  guards a localhost database with a dev password, and the divergence already ran the wrong way,
  a workstation on `.env.example`'s fixed value against every container on a random one. **`.env`
  is now the provisioner's, rewritten whole every run and copied from `.env.example`**, which is
  promoted from illustration to *source* — the two files restated the same connection strings and
  could disagree about a password. `leaving it alone` is retired: it protected a *generated*
  secret, and its cost was live on the closing session's own container, an image-dated `.env`
  holding an earlier session's secret that no fix to the generator could ever have reached. The
  override channel is the **ambient environment**, which survives a rewrite by design; `diff` to
  `.env.example` is exactly one line, the storage root. **Ticket 02's signing fault is refuted**:
  the path it called missing is a 0-byte file the platform signer ignores, a probe commit carries
  a real `gpgsig`, and the row was inferred from a directory listing with no commit ever made —
  corrected in place. **The push credential never lands on the machine** (`GH_TOKEN=proxy-injected`;
  auth injected in flight by the loopback proxy), which closes *what must never enter the repo*
  with no new machinery: nothing here holds a credential to leak. So the line shipped is **`INFO
  git`** — identity, signing on/off, signer program — no network, no gate; a remote-reachability
  probe was rejected as the false accusation ticket 09 deleted, and a key-present assertion would
  go BROKEN on a machine that signs perfectly. Signature *verification* ruled out of scope. verify
  green; checkup fit in **1.5s**.

- 2026-08-12 — [The harness for an unattended machine](tickets/16-the-harness-for-an-unattended-machine.md)
  — fifteen tickets made the *machine* correct and left the *session protocol* almost entirely
  prose, which is what an unwatched container is worst at honouring. **The one mechanical guard in
  the repo had never executed**: `.githooks/pre-push` is committed, but git reads `.git/hooks`,
  `core.hooksPath` is repo-local config no clone carries, and the file was mode `644` — ADR-0008's
  "safety by mechanism" was neither, on every Linux machine this repo has ever run on. Cured at the
  provisioner (set, read back, executable bit tested, **refuse** if it did not take) and the hook
  gained the guard it should have had: a push to `main` is refused, override named, proven on a
  real push rather than a dry run. **Rule 6 became `pnpm land`** — fetch → merge → verify → push,
  refusing a dirty tree, a conflicted merge, a red verify and `main`; ADR-0010 unchanged in
  substance, its three subtle failure modes now refusals instead of reading comprehension.
  **A session was told to check in and cannot** (`AskUserQuestion` denied, nobody watching):
  ruled **assume, name, finish**. **`main` is unprotected on GitHub** — the required check
  ADR-0010's amendment leans on unblocks nothing today; not papered over, named as the one human
  step (below). `checkup`'s environment line gains `branch@sha +dirty`, completing ticket 07's
  citability rule, and its unfit verdict now names the ~2s `pg_ctlcluster … start` when the only
  BROKEN line is a native database — the question this map left open. Rejected: repair in the
  hook (again), a BROKEN line for an unwired hook (fitness is verify/`test:db`/dev, and widening
  it makes checkup a second verify), the Docker-stopping CI job (below, on its own merits), and
  CLAUDE.md's response-style section (the platform prompt carries it). CLAUDE.md came out
  **smaller while gaining four subjects** — 5,410 → 5,287 chars — and its `DB:` line stopped
  saying *compose-managed*, which was false on every cloud container. **ADR-0011.**

## Not yet specified

<!-- Three patches graduated to tickets 13/14/15 on 2026-08-12; the map is charted to its
     destination and this section is expected to stay thin. -->

- **`main` is unprotected, so the required check is a plan and not a gate.** Read from the API
  2026-08-12 (ticket 16): `"protected": false`. ADR-0010's amendment retires the SHA-stamped
  evidence comment "when the check exists" — `ci` exists and is green on four runs, but nothing
  requires it and nothing requires a branch to be up to date, so the merge button is gated by the
  dispatcher's eye alone and a red PR can still be clicked. This is not a session's to fix: it is
  one administrative act by a repository admin (require the `ci` check, tick *require branches to
  be up to date*), and it is the last mechanical step in the landing path. Recorded here because
  an amendment that reads as landed and is not is precisely the fault ticket 13 corrected in
  ticket 15.

- **Nothing unattended exercises the native-Postgres path.** Ticket 13 put CI on `ubuntu-latest`,
  which ships a Docker daemon, so every CI run takes the **compose** path — the one the Windows
  workstation already covers. The native-cluster branch runs on every cloud session and is checked
  by nobody but the session that happens to be in it. Forcing native by hiding the daemon was put
  and rejected: it feeds ticket 05's detector a false premise. **The measurement this waited on is
  now taken** (2026-08-12): `provision.sh` goes green on a GitHub-hosted runner — 77s, compose
  path, `parity: ok in 46s`, all four legs — so the precondition is cleared and this is ticketable
  whenever someone picks it up. What the run also showed is that a *runner is not the sandbox*: it
  is the first non-root machine the provisioner has met, and it found a real defect there, which
  is the argument that a second unattended machine shape is worth having rather than a formality.

- **`db:replay` has no CI invoker while it is red at head.** The workflow ticket 13 specified now
  exists, but with one of its two steps held: the drill fails on 0010's
  `ADD COLUMN "semantic" text NOT NULL` against restored rows — ticket 10's finding, ruled
  unrepairable there and still standing. Because the baseline is the parent of the newest
  migration-bearing commit, this is red on *every* commit until a new migration moves it past 0010,
  so wiring it up today would make `ci` red from birth and block the required check that is the
  point of the workflow. **The trigger is precise: the commit that lands migration 0012** — the
  first on which the drill is green and meaningful. Pinning `REPLAY_BASELINE` past 0010 was put and
  rejected as rigging a check to pass. Not fog so much as a dated debt, recorded here because the
  step's absence is invisible in a passing build.

- **A natively-started Postgres does not survive the container's process tree restarting.** The
  cold container of ticket 08 was green through provisioning and 46 `test:db` tests, then had no
  listener on 5544 six minutes later. `checkup` caught it and named the repair, so nothing is
  silent. Ticket 12 closed the *arrival* half — a `SessionStart` hook now routes a session to the
  repair before turn one — and **narrowed the cost objection**: `pg_ctlcluster 16 main start`
  brought the cluster back in ~2s, so the mid-session repair is not necessarily the full parity
  gate that made this look expensive. What stays: whether the **compose path shares the fault**,
  what actually kills the cluster, and whether `checkup`'s repair pointer should name the cheap
  restart when the *only* BROKEN line is the database. **Two of those three moved on 2026-08-12
  (ticket 16).** The pointer question is answered — `checkup` now names the cheap restart when it
  measures the cluster down on the native path — and it was answered *by the fault*: the same
  session's container restarted its process tree between turns, the cluster died, the hook
  reported it before turn one, and `pg_ctlcluster 16 main start` brought it back in **2.95s**
  printing *"Removed stale pid file"*. That stale pid file is the first evidence about the cause
  and the second observation of the ~2s figure. What stays open is the compose path — nobody has
  seen this on a machine with a Docker daemon — and *what* stops the cluster, which the pid file
  narrows but does not name.

- **A dbspec assumes it owns the database.** `tenancy.dbspec`'s cleanup is
  `delete from users where email like '%@dbspec.local'` — a reach across every suite, which holds
  only because the database starts empty and no other suite leaves a membership behind. Ticket 10
  found it by handing the suite a database that legitimately held other rows, and routed around it
  (`db:drift` as the drill's last step) rather than editing a fixture inside a ticket whose
  guardrail forbade it. Whether test isolation is this effort's business at all is the first
  question — the destination is parity and legibility, and this may belong to whichever effort
  owns the test lane.

## Out of scope

- Playwright e2e placement (ADR-0007 already puts it outside the lane).
- Any change to what `verify`'s existing four stages check.
- **Production deployment.** This effort proves cold-start provisioning of a *dev workspace*;
  a deployment target is its own effort and must not be smuggled in through the provisioner.
  The shared property — clean checkout, nothing pre-warmed — stays in.
- **A packet-level egress proof.** Ticket 08 blocked egress with `curl`/`wget` shims because the
  permission classifier declined `iptables`, proving the provisioner makes no outbound call but
  not that nothing on the machine could. The stronger proof is curiosity: no decision waits on it,
  and it would mean blocking egress in a container whose own agent proxy sits on loopback. Ruled
  out 2026-08-12 while charting the map's end.
- **The loop's caps as measured numbers.** `docs/specs/loop.md` marks `MAX_TURNS = 150` and the
  30-minute wall fuse "re-derive, don't trust", carried from a legacy environment whose verify was
  ~100s against our ~28–43s. Re-deriving needs a real campaign and **there are no arcs yet**, so
  it cannot be ticketed here; it belongs to whichever effort runs the first one. A disposable
  container removes the "seizes a precious machine" objection for free, which is this effort's
  contribution and the end of it.
