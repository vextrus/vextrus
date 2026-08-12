# 09 — Cold-provisioning proof

Measurement only. No source file was changed, nothing was repaired. A fault below is a
finding, not a defect in the measurement.

Container booted and ran `scripts/provision.sh` from
`claude/wayfinder-harness-tickets-bf4tml` @ `c78979b`. This harness took control at
`12:48:48Z` and made its own timed run at `12:49:17Z`.

## Answers

**Was this container EMPTY, or restored from a pre-provisioned image snapshot?**
**Empty, and provisioned at boot — 98 seconds before this harness got control.** The mtimes
settle it. `/` is `12:47:05`; every artefact of provisioning is *newer*:

```
2026-08-12 12:47:05.473094051 +0000 /
2026-08-12 12:47:57.089092870 +0000 node_modules
2026-08-12 12:47:35.332517684 +0000 cad/.venv
2026-08-12 12:47:19.745093724 +0000 .env
```

Nothing the provisioner produces came from an image layer. `.data/provision.log` opens at
`2026-08-12T12:47:10Z` — five seconds after `/` — so the first run happened in this container,
on an empty tree, unattended. What *did* come from image layers is the pre-existing Node
estate: `/opt/node20/bin/node` (Mar 24), `/opt/node21/bin/node` (Apr 10 2024), and
`/opt/node22/bin/node.vextrus-displaced` (Mar 24 04:31) — all older than `/`. The displaced
file's Mar 24 date is the *image's* v22 binary carrying its original mtime through `mv`; it
says nothing about when it was shadowed. The symlink that replaced it is dated `12:47`, i.e.
this container.

**This matters for everything below:** the run in step 2 is the container's **second**
provisioning, not its first. The genuinely cold measurement is the boot run at `12:47:10`,
which is preserved in the log because `provision.sh` **appends** rather than truncates.
Both runs are in the raw capture, in order.

**Exit status, WALL, final `provision:` line, `parity:` verdict** — the timed step-2 run:

```
EXIT=0
WALL=58s
parity: ok in 54s — checkup | verify | test:db | dev (:3210) all pass
provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed
```

The boot run reached the same two lines with `parity: ok in 57s`. Its wall clock is **~83s**
— log stamp `12:47:10Z` to the log's last write at `12:48:33.85` — a start-stamp-to-mtime
figure, not one the log states. Its exit status was not observed by this harness; the run
predates it.

**The node phase — did it DOWNLOAD Node, or find one present?**
**Both answers exist in this container, one per run.** Cold, it downloaded:

```
provision: user=root node=/opt/node22/bin/node docker=/usr/bin/docker
provision: installing Node v24.19.0 (x64) from nodejs.org
provision: shadowing /opt/node22/bin/node (v22) -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
provision: shadowed: /opt/node22/bin
```

Warm, at step 2, it found the install it had made and skipped the fetch:

```
provision: node v24.19.0 already on PATH at /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin — nothing to install
provision: node v24.19.0 at /opt/node22/bin/node (as a session resolves it)
```

The re-entrant path is exercised and it is quiet — no second download, no second shadow, no
second `.vextrus-displaced` file. `.env` and the cluster get the same treatment
(`.env exists — leaving it alone`, `Cluster is already running.`).

**Which Postgres path, and was there a Docker daemon?**
**Native**, and **no daemon**. The `docker` *binary* exists at `/usr/bin/docker` — the
provisioner's own preamble reports it — but `docker info` fails, so the daemon does not exist:

```
docker NO
provision: no docker daemon — native postgres cluster on 5544
```

`pg_lsclusters` confirms the cluster the native path uses, already up when this harness looked:

```
Ver Cluster Port Status Owner    Data directory              Log file
16  main    5544 online postgres /var/lib/postgresql/16/main /var/log/postgresql/postgresql-16-main.log
```

Checkup agrees from the other side, on both runs: `[note] docker no daemon reachable —
native-Postgres path`, and `[ok] pg profile PostgreSQL 16 · UTF8 · C.UTF-8 · no extensions —
compose and native agree`. Unlike ticket 08's container, the cluster was **still alive** when
this harness ran: `checkup` passed its database leg at 12:49, no regression between
provisioning and measurement.

**`verify: green in Ns` and each stage's timing.**

| stage    | cold (boot, 12:47) | warm (step 2, 12:49) |
| -------- | ------------------ | -------------------- |
| typecheck| 7.3s               | 6.1s                 |
| lint     | 2.6s               | 2.2s                 |
| test     | 6.9s               | 4.7s                 |
| cad:ruff | 0.0s               | 0.0s                 |
| cad:test | 1.0s               | 0.7s                 |
| build    | 17.8s              | 20.3s                |
| **green**| **35.5s**          | **34.1s**            |

Both green. Every stage is faster warm except `build`, which is 2.5s *slower* — measured, not
explained. Totals barely move because the build leg dominates and moves the wrong way.

**The cold-vs-warm pair for `cad.spec.ts` and `boundaries.spec.ts`.**

This is the number the document exists for, and the honest answer needs a caveat about what
was capturable. Vitest's default reporter emitted per-file lines in the **cold** verify only.
In the warm step-2 verify, and in the step-3 warm runs, it printed **no per-file lines at
all** — only the totals block. So there is no warm per-file total to set against the cold one;
that measurement was not captured, and cannot be, from a run where nothing is slow. (The two
observations correlate — files are listed when at least one is slow, suppressed when none is —
but that is an inference from two runs, not a mechanism this harness verified.) `--reporter=verbose`
gives per-**test** durations instead, which *are* comparable across cold and warm, because the
cold default reporter also broke out its slow files test-by-test.

Per-file totals, cold verify (`verify: test`, 12:47:51):

```
✓ src/__tests__/boundaries.spec.ts (7 tests) 983ms
✓ src/modules/takeoff/__tests__/cad.spec.ts (4 tests) 2315ms
```

Per-test, cold against warm:

| test                                                          | cold   | warm   |
| ------------------------------------------------------------- | ------ | ------ |
| cad.spec › ingests the fixture into the artifact …             | 1644ms | 450ms  |
| cad.spec › refuses a corrupt drawing by name …                 | 326ms  | 395ms  |
| cad.spec › refuses a drawing that is not there                 | 334ms  | 363ms  |
| boundaries.spec › flags a deep cross-module import             | 876ms  | 1004ms |

Cold figures are the boot verify at 12:47:51; warm are the verbose run at 12:51:08 (section 4).
The 12:50:50 verbose run differs only in noise — "refuses a drawing that is not there" 461ms
there against 363ms — so nothing below turns on which warm run is read.

**What this pair does and does not support.** One test carries the whole cold penalty:
`cad.spec › ingests the fixture` at **1644ms cold against 450ms warm, 3.7×** — the run that
first materializes the Python toolchain. The other three move by less than 100ms, in both
directions. `boundaries.spec` shows **no cold penalty at all** here: its slow test was 876ms
cold and **1004ms warm**, i.e. warm was slower, and the file's cold total of 983ms is nowhere
near a bound.

Set against the numbers `vitest.config.ts` cites for this ticket — "cad.spec 5006ms cold
against 1.06s warm, boundaries.spec 9.2s against 713ms" — **this container did not reproduce
them.** The worst thing measured here is 2315ms for a whole file, less than half the 5s default
this ticket's timeout change was made against; nothing came within reach of it, and no spec
went red at any point. The direction of the cad.spec effect is corroborated; its magnitude is
not, and the boundaries.spec effect is absent. Stated as a finding, not a correction: a
container that provisions in 83s with a hot package cache is a milder machine than the one
those figures came from, and this run is one sample of one container.

**Anything that failed or looked wrong.**
Nothing failed. Both provisioning runs exited on the unqualified pass line, `parity` passed
both times, `verify` was green both times, and all 113 unit tests, 46 db tests and 35 cad
tests passed on every run. Four observations, none of them defects:

1. **`.data/provision.log` appends.** After two runs it is 361 lines holding both, with no
   separator beyond the `=== <stamp> ===` header. Useful here — it is the only reason the cold
   run survived step 2 — but a reader who assumes one run per file will misread it.
2. **The default reporter's per-file lines are not reliably there.** Section 5 below is the
   evidence. Any future ticket that needs a warm per-file total must ask for it explicitly;
   `pnpm vitest run` will not print one on a fast tree.
3. **`build` is slower warm than cold** (20.3s vs 17.8s), against every other stage. Not
   investigated.
4. **Test count moved since ticket 08** — 109 tests over 11 files there, 113 over 11 files
   here. The tree advanced (`c78979b`); the specs are not the same specs.

Machine: 4 cores, 16075 MB total memory, 13272 MB free at step 1.

---

# Raw captures

## 1. `cat .data/provision.log` — both runs, verbatim

The first run (`=== 2026-08-12T12:47:10Z ===`) is the container's cold boot provisioning,
which this harness did not launch. The second (`=== 2026-08-12T12:49:17Z ===`) is step 2.

```
provision: === 2026-08-12T12:47:10Z ===
provision: logging to /home/user/vextrus/.data/provision.log
provision: repo at /home/user/vextrus
provision: user=root node=/opt/node22/bin/node docker=/usr/bin/docker
provision: installing Node v24.19.0 (x64) from nodejs.org
provision: shadowing /opt/node22/bin/node (v22) -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
provision: shadowed: /opt/node22/bin
provision: node v24.19.0 at /opt/node22/bin/node (as a session resolves it)
provision: no docker daemon — native postgres cluster on 5544
CREATE ROLE
CREATE DATABASE
provision: wrote .env
Preparing pnpm@9.15.1 for immediate activation...
(node:742) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
(Use `node --trace-deprecation ...` to show where the warning was created)
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +213
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

   ╭───────────────────────────────────────────────────────────────────╮
   │                                                                   │
   │                Update available! 9.15.1 → 11.21.0.                │
   │   Changelog: https://github.com/pnpm/pnpm/releases/tag/v11.21.0   │
   │         Run "corepack install -g pnpm@11.21.0" to update.         │
   │                                                                   │
   ╰───────────────────────────────────────────────────────────────────╯

Progress: resolved 213, reused 0, downloaded 16, added 4
Progress: resolved 213, reused 0, downloaded 40, added 29
Progress: resolved 213, reused 0, downloaded 58, added 48
Progress: resolved 213, reused 0, downloaded 72, added 61
Progress: resolved 213, reused 0, downloaded 73, added 61
Progress: resolved 213, reused 0, downloaded 170, added 170
Progress: resolved 213, reused 0, downloaded 212, added 212
Progress: resolved 213, reused 0, downloaded 213, added 212
Progress: resolved 213, reused 0, downloaded 213, added 213, done
.../esbuild@0.18.20/node_modules/esbuild postinstall$ node install.js
.../esbuild@0.25.12/node_modules/esbuild postinstall$ node install.js
.../esbuild@0.28.2/node_modules/esbuild postinstall$ node install.js
.../esbuild@0.18.20/node_modules/esbuild postinstall: Done
.../esbuild@0.25.12/node_modules/esbuild postinstall: Done
.../esbuild@0.28.2/node_modules/esbuild postinstall: Done

dependencies:
+ @trpc/server 11.18.0
+ better-auth 1.6.27
+ drizzle-orm 0.45.2
+ next 16.3.0
+ postgres 3.4.9
+ react 19.2.8
+ react-dom 19.2.8
+ zod 4.4.3

devDependencies:
+ @tailwindcss/postcss 4.3.3
+ @types/node 26.2.0
+ @types/react 19.2.18
+ @types/react-dom 19.2.4
+ drizzle-kit 0.31.10
+ eslint 10.8.1
+ tailwindcss 4.3.3
+ tsx 4.23.12
+ typescript 6.0.3
+ typescript-eslint 8.67.0
+ vitest 4.1.10

Done in 11.7s
Using CPython 3.13.12 interpreter at: /usr/bin/python3.13
Creating virtual environment at: .venv
   Building vextrus-cad @ file:///home/user/vextrus/cad
Downloading fonttools (4.7MiB)
Downloading numpy (15.9MiB)
Downloading pygments (1.2MiB)
Downloading ezdxf (5.5MiB)
Downloading ruff (10.9MiB)
 Downloading ruff
 Downloading pygments
 Downloading ezdxf
 Downloading fonttools
 Downloading numpy
      Built vextrus-cad @ file:///home/user/vextrus/cad
Prepared 12 packages in 1.34s
Installed 12 packages in 26ms
 + ezdxf==1.4.4
 + fonttools==4.63.0
 + iniconfig==2.3.0
 + numpy==2.5.2
 + packaging==26.3
 + pluggy==1.6.0
 + pygments==2.20.0
 + pyparsing==3.3.2
 + pytest==9.1.1
 + ruff==0.16.2
 + typing-extensions==4.16.0
 + vextrus-cad==0.0.0 (from file:///home/user/vextrus/cad)

> vextrus@0.0.0 db:migrate /home/user/vextrus
> node scripts/db-migrate.mjs

applied 0000_core-tenancy.sql
applied 0001_tenancy-rls.sql
applied 0002_auth-tables.sql
applied 0003_auth-lane-rls.sql
applied 0004_register-spine.sql
applied 0005_register-rls.sql
applied 0006_ingest-queue.sql
applied 0007_ingest-queue-rls.sql
applied 0008_register-sightings.sql
applied 0009_register-sightings-rls.sql
applied 0010_sighting-semantic.sql
applied 0011_sighting-per-ingest.sql
db:migrate: 12 applied
parity: running legs on a session's PATH, not the provisioner's
parity: node v24.19.0 at /opt/node22/bin/node

parity: --- checkup ---

> vextrus@0.0.0 checkup /home/user/vextrus
> node scripts/checkup.mjs


  [ok]     database     vextrus on 127.0.0.1:5544 · PostgreSQL 16.13 · as vextrus
  [ok]     pg profile   PostgreSQL 16 · UTF8 · C.UTF-8 · no extensions — compose and native agree
  [ok]     roles        vextrus, vextrus_app, vextrus_auth
  [ok]     drift        schema in sync with db/migrations
  [ok]     port 3210    free
  [ok]     uv           uv 0.8.17
  [ok]     node         v24.19.0 (engines >=24)
  [ok]     pnpm         9.15.1
  [ok]     NODE_ENV     unset
  [note]   docker       no daemon reachable — native-Postgres path
  [info]   environment  2026-08-12T12:47:39Z · linux x64 · node v24.19.0 · postgres via native (no docker daemon) · Ubuntu 16.13-0ubuntu0.24.04.1 · /var/lib/postgresql/16/main

checkup: fit for work — verify, test:db and dev can all run (0.8s)

parity: --- verify ---

> vextrus@0.0.0 verify /home/user/vextrus
> node scripts/verify.mjs

verify: typecheck ok (7.3s)
verify: lint ok (2.6s)

[1m[30m[46m RUN [49m[39m[22m [36mv4.1.10 [39m[90m/home/user/vextrus[39m

 [32m✓[39m src/modules/takeoff/__tests__/placement.spec.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 21[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/grid.spec.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 49[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/views.spec.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 76[2mms[22m[39m
 [32m✓[39m src/core/__tests__/pairing.spec.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/revision.spec.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m src/core/__tests__/register.spec.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m src/__tests__/boundaries.spec.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 983[2mms[22m[39m
     [33m[2m✓[22m[39m flags a deep cross-module import [33m 876[2mms[22m[39m
 [32m✓[39m src/__tests__/view-law.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 21[2mms[22m[39m
 [32m✓[39m src/core/__tests__/entitygraph.spec.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 34[2mms[22m[39m
 [32m✓[39m src/core/__tests__/storage.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 24[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/cad.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 2315[2mms[22m[39m
     [33m[2m✓[22m[39m ingests the fixture into the artifact the pipeline committed [33m 1644[2mms[22m[39m
     [33m[2m✓[22m[39m refuses a corrupt drawing by name, never as an empty success [33m 326[2mms[22m[39m
     [33m[2m✓[22m[39m refuses a drawing that is not there [33m 334[2mms[22m[39m

[2m Test Files [22m [1m[32m11 passed[39m[22m[90m (11)[39m
[2m      Tests [22m [1m[32m113 passed[39m[22m[90m (113)[39m
[2m   Start at [22m 12:47:51
[2m   Duration [22m 5.77s[2m (transform 2.41s, setup 0ms, import 9.15s, tests 3.55s, environment 1ms)[22m

verify: test ok (6.9s)
All checks passed!
verify: cad:ruff ok (0.0s)
...................................                                      [100%]
35 passed in 0.45s
verify: cad:test ok (1.0s)
▲ Next.js 16.3.0 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 83ms
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry


  Creating an optimized production build ...
✓ Compiled successfully in 9.3s
  Running TypeScript ...
  Finished TypeScript in 5.1s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/4) ...
  Generating static pages using 3 workers (1/4) 
  Generating static pages using 3 workers (2/4) 
  Generating static pages using 3 workers (3/4) 
✓ Generating static pages using 3 workers (4/4) in 152ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/auth/[...all]
├ ƒ /api/trpc/[trpc]
└ ○ /login


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

verify: build ok (17.8s)

verify: green in 35.5s

parity: --- test:db ---

> vextrus@0.0.0 test:db /home/user/vextrus
> vitest run -c vitest.db.config.ts


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.10 [39m[90m/home/user/vextrus[39m

 [32m✓[39m db/__tests__/register.dbspec.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 206[2mms[22m[39m
 [32m✓[39m db/__tests__/revision-delta.dbspec.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 211[2mms[22m[39m
 [32m✓[39m src/server/__tests__/ingest.dbspec.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 2064[2mms[22m[39m
     [33m[2m✓[22m[39m lands the fixture's artifact and its fidelity counters, visible via tRPC [33m 486[2mms[22m[39m
     [33m[2m✓[22m[39m a second upload of the same drawing takes the next seq [33m 463[2mms[22m[39m
     [33m[2m✓[22m[39m a corrupt DXF fails loudly with a named error [33m 391[2mms[22m[39m
     [33m[2m✓[22m[39m shows the newest ingest of a revision, never a superseded one [33m 432[2mms[22m[39m
 [32m✓[39m db/__tests__/register-door.dbspec.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 190[2mms[22m[39m
 [32m✓[39m src/server/__tests__/auth.dbspec.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 365[2mms[22m[39m
 [32m✓[39m db/__tests__/tenancy.dbspec.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 84[2mms[22m[39m

[2m Test Files [22m [1m[32m6 passed[39m[22m[90m (6)[39m
[2m      Tests [22m [1m[32m46 passed[39m[22m[90m (46)[39m
[2m   Start at [22m 12:48:17
[2m   Duration [22m 9.36s[2m (transform 813ms, setup 0ms, import 5.27s, tests 3.12s, environment 1ms)[22m


parity: --- dev server (:3210) ---
parity: dev answered 200 on :3210
parity: :3210 released

parity: ok in 57s — checkup | verify | test:db | dev (:3210) all pass

provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed
provision: === 2026-08-12T12:49:17Z ===
provision: logging to /home/user/vextrus/.data/provision.log
provision: repo at /home/user/vextrus
provision: user=root node=/opt/node22/bin/node docker=/usr/bin/docker
provision: node v24.19.0 already on PATH at /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin — nothing to install
provision: node v24.19.0 at /opt/node22/bin/node (as a session resolves it)
provision: no docker daemon — native postgres cluster on 5544
Cluster is already running.
provision: .env exists — leaving it alone
Preparing pnpm@9.15.1 for immediate activation...
(node:5003) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
(Use `node --trace-deprecation ...` to show where the warning was created)
Lockfile is up to date, resolution step is skipped
Already up to date

Done in 1.3s
Audited 12 packages in 0.29ms

> vextrus@0.0.0 db:migrate /home/user/vextrus
> node scripts/db-migrate.mjs

up to date
parity: running legs on a session's PATH, not the provisioner's
parity: node v24.19.0 at /opt/node22/bin/node

parity: --- checkup ---

> vextrus@0.0.0 checkup /home/user/vextrus
> node scripts/checkup.mjs


  [ok]     database     vextrus on 127.0.0.1:5544 · PostgreSQL 16.13 · as vextrus
  [ok]     pg profile   PostgreSQL 16 · UTF8 · C.UTF-8 · no extensions — compose and native agree
  [ok]     roles        vextrus, vextrus_app, vextrus_auth
  [ok]     drift        schema in sync with db/migrations
  [ok]     port 3210    free
  [ok]     uv           uv 0.8.17
  [ok]     node         v24.19.0 (engines >=24)
  [ok]     pnpm         9.15.1
  [ok]     NODE_ENV     unset
  [note]   docker       no daemon reachable — native-Postgres path
  [info]   environment  2026-08-12T12:49:23Z · linux x64 · node v24.19.0 · postgres via native (no docker daemon) · Ubuntu 16.13-0ubuntu0.24.04.1 · /var/lib/postgresql/16/main

checkup: fit for work — verify, test:db and dev can all run (0.7s)

parity: --- verify ---

> vextrus@0.0.0 verify /home/user/vextrus
> node scripts/verify.mjs

verify: typecheck ok (6.1s)
verify: lint ok (2.2s)

 RUN  v4.1.10 /home/user/vextrus


 Test Files  11 passed (11)
      Tests  113 passed (113)
   Start at  12:49:33
   Duration  3.83s (transform 703ms, setup 0ms, import 6.03s, tests 2.79s, environment 1ms)

verify: test ok (4.7s)
All checks passed!
verify: cad:ruff ok (0.0s)
...................................                                      [100%]
35 passed in 0.43s
verify: cad:test ok (0.7s)
▲ Next.js 16.3.0 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 26ms

  Creating an optimized production build ...
✓ Compiled successfully in 11.1s
  Running TypeScript ...
  Finished TypeScript in 6.0s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/4) ...
  Generating static pages using 3 workers (1/4) 
  Generating static pages using 3 workers (2/4) 
  Generating static pages using 3 workers (3/4) 
✓ Generating static pages using 3 workers (4/4) in 152ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/auth/[...all]
├ ƒ /api/trpc/[trpc]
└ ○ /login


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

verify: build ok (20.3s)

verify: green in 34.1s

parity: --- test:db ---

> vextrus@0.0.0 test:db /home/user/vextrus
> vitest run -c vitest.db.config.ts


 RUN  v4.1.10 /home/user/vextrus


 Test Files  6 passed (6)
      Tests  46 passed (46)
   Start at  12:49:59
   Duration  8.55s (transform 332ms, setup 0ms, import 4.60s, tests 3.03s, environment 1ms)


parity: --- dev server (:3210) ---
parity: dev answered 200 on :3210
parity: :3210 released

parity: ok in 54s — checkup | verify | test:db | dev (:3210) all pass

provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed
```

## 2. Step 1 — starting state, before this harness touched anything

Captured at `12:48:48Z`, 98s after `/` was created and 15s after the boot provisioning's last
write. Command as given, output verbatim.

```
Wed Aug 12 12:48:48 UTC 2026
2026-08-12 12:47:05.473094051 +0000 /
2026-08-12 12:47:57.089092870 +0000 node_modules
2026-08-12 12:47:35.332517684 +0000 cad/.venv
2026-08-12 12:47:19.745093724 +0000 .env
total 28
drwxr-xr-x  3 root root  4096 Aug 12 12:48 .
drwxr-xr-x 15 root root  4096 Aug 12 12:48 ..
drwxr-xr-x  2 root root  4096 Aug 12 12:47 artifacts
-rw-r--r--  1 root root   370 Aug 12 12:48 parity-dev.log
-rw-r--r--  1 root root 10944 Aug 12 12:48 provision.log
v24.19.0
/opt/node22/bin/node
/opt/node22/bin/node
/usr/local/bin/node
lrwxrwxrwx 1 root   root          54 Aug 12 12:47 /opt/node22/bin/node -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
-rwxr-xr-x 1 ubuntu ubuntu 124679552 Mar 24 04:31 /opt/node22/bin/node.vextrus-displaced
lrwxrwxrwx 1 root   root          42 Mar 31 13:31 /opt/node22/bin/nodemon -> ../lib/node_modules/nodemon/bin/nodemon.js
Ver Cluster Port Status Owner    Data directory              Log file
16  main    5544 online postgres /var/lib/postgresql/16/main /var/log/postgresql/postgresql-16-main.log
docker NO
c78979b harness: raise the runner's net above first-touch cost
4
               total        used        free      shared  buff/cache   available
Mem:           16075         776       13272          32        2361       15298
Swap:              0           0           0
```

Note `which -a node` returns three entries here, not ticket 08's four: the v24 bindir is
**not** on this shell's PATH. Node still resolves to v24 through the `/opt/node22/bin` shadow
alone — the mechanism that makes the shadow worth having, observed working without the PATH
prepend.

`.data/` already held `provision.log` (10944 bytes) and `parity-dev.log` at step 1: further
confirmation that a full provisioning, parity legs and all, had already run in this container.

## 3. Step 2 — the timed gate

Command as given. The run's console output is the second half of section 1 verbatim — the
provisioner tees to the log — so it is not repeated. The harness's own two lines:

```
EXIT=0
WALL=58s
```

58s wall against `parity: ok in 54s` leaves 4s for the node check, the cluster check, the
`.env` check, `pnpm install` (1.3s, "Already up to date"), `uv sync` (0.29ms audit) and
`db:migrate` ("up to date"). The warm re-entrant path costs essentially nothing; the gate's
whole cost is parity.

## 4. Step 3 — the warm comparison, `pnpm vitest run --reporter=verbose 2>&1 | tail -60`

Run twice. The first execution (`Start at 12:50:50`) reported `Duration 3.76s (transform 636ms,
setup 0ms, import 5.48s, tests 2.91s, environment 1ms)`, 11 files / 113 tests passed. The
capture below is the second execution (`Start at 12:51:08`), taken to a file so the whole
stream could be kept rather than only its tail; its `tail -60` is what follows.

```
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the grid backbone > honours the world transform of the 1.5x-scaled bubble 2ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the grid backbone > moves no axis for a grid bubble stamped inside a non-layout view 3ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the grid backbone > defers with a named reason when the layout plan is stripped of bubble evidence 3ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > reads free-standing bubbles — bare text inside an original circle 2ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > never invents a bubble from a bare label with no circle around it 1ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > never reads a bubble out of derived paint alone 1ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > refuses a label that is neither a bare letter nor a bare numeral 1ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > defers rather than guess when one family's direction is undecidable 0ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > takes a lone axis's direction from the other family, never from a guess 0ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > collapses a repeated label to one axis and keeps both its bubbles as evidence 2ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > reports no spacing, with a named reason, when no family has two axes 0ms
 ✓ src/modules/takeoff/__tests__/grid.spec.ts > the bubble signature > georeferences every layout-plan view of a sheet separately 1ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts > the cad ingest subprocess > refuses a drawing that is not there 363ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts > the cad ingest subprocess > refuses rather than hangs when the pipeline outruns its timeout 6ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > carries a nudged member's ordinal, and retires the deleted sibling's 3ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > never lets an ordinal migrate when the deleted member sorts first 1ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > refuses to pair a member two priors sit equally near, and says which 1ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > carries nobody beyond the bound, and nobody at all where no bound is stated 1ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > pairs nobody across views, so a second sighting still meets the door's guard 0ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > keeps its result independent of the order the sightings arrive in 1ms
 ✓ src/core/__tests__/pairing.spec.ts > pairing a revision with the register > reports a whole family the revision dropped, rather than saying nothing 0ms
 ✓ src/core/__tests__/pairing.spec.ts > the semantic (identity.md §5) > changes when the cited evidence moves, though the numbers do not 0ms
 ✓ src/core/__tests__/pairing.spec.ts > the semantic (identity.md §5) > is order-normalized: the same content in any order is the same string 0ms
 ✓ src/core/__tests__/pairing.spec.ts > the semantic (identity.md §5) > reads the anchor back out of the placement key, and never invents one 0ms
 ✓ src/modules/takeoff/__tests__/revision.spec.ts > the revision pair, walked > keeps one layout-plan view under a retitled caption 3ms
 ✓ src/modules/takeoff/__tests__/revision.spec.ts > the revision pair, walked > states the carry bound as a share of the view's own grid spacing 1ms
 ✓ src/modules/takeoff/__tests__/revision.spec.ts > the revision pair, walked > differs from rev 1 by columns and nothing else 0ms
 ✓ src/modules/takeoff/__tests__/revision.spec.ts > the revision pair, walked > re-presents the members whose cited evidence moved, and only carries the rest 1ms
 ✓ src/modules/takeoff/__tests__/revision.spec.ts > the revision pair, walked > names the added column's absence rather than placing an unwitnessed class 1ms
 ✓ src/modules/takeoff/__tests__/revision.spec.ts > the revision pair, walked > carries a named reason on every absence, deferral and disposition it states 2ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > places the nine columns of the plan, one per grid intersection 4ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > takes the element class from the schedule's caption, never from the mark 7ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > keys each placement by content — view, mark, quantized position 5ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > signs each instance with its authored footprint only 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > accounts for every original in the view, exactly once 2ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > yields no instance from the bubble, the arc or the slab — each by name 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > scales every constant by the grid spacing, and defers when there is none 3ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > placement on the fixture sheet > holds the marks of a non-countable view out of the count 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > the placement constants > are shares, and only shares 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > mark normalization (§9) > strips the size parenthetical — both forms are the drawing's own 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > mark normalization (§9) > compares dotless-uppercase, so TB matches a registered T.B 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > mark normalization (§9) > reads a member mark, and nothing that merely looks like one 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > the level slot (§9) > puts foundation classes on the lawful-null FOUNDATION basis 0ms
 ✓ src/modules/takeoff/__tests__/placement.spec.ts > the level slot (§9) > leaves vertical classes UNRESOLVED until a human authors a level 0ms
 ✓ src/__tests__/view-law.spec.ts > the view law's single decision site > finds no second site in shipped source 15ms
 ✓ src/__tests__/view-law.spec.ts > the view law's single decision site > goes red when a second site is introduced 0ms
 ✓ src/__tests__/view-law.spec.ts > the view law's single decision site > goes red on any view type, not just the countable one 0ms
 ✓ src/__tests__/view-law.spec.ts > the view law's single decision site > leaves code that imports the predicate alone 0ms
 ✓ src/core/__tests__/register.spec.ts > mark families and ordinals > keys a family of several as mark#i, and a singleton by its bare mark 2ms
 ✓ src/core/__tests__/register.spec.ts > mark families and ordinals > orders a family by its content signature, not by where its members sit 0ms
 ✓ src/core/__tests__/register.spec.ts > mark families and ordinals > tie-breaks identical signatures on the placement key, never on order 1ms
 ✓ src/core/__tests__/register.spec.ts > mark families and ordinals > keeps one family per (class, level slot, dotless mark) 1ms
 ✓ src/core/__tests__/register.spec.ts > mark families and ordinals > registers two spellings of one family under one mark 0ms
 ✓ src/core/__tests__/register.spec.ts > mark families and ordinals > orders spellings that differ only in case by code unit, not by locale 0ms

 Test Files  11 passed (11)
      Tests  113 passed (113)
   Start at  12:51:08
   Duration  3.51s (transform 555ms, setup 0ms, import 4.95s, tests 2.54s, environment 1ms)

```

### The two named specs, extracted from that same warm verbose stream

```
 ✓ src/__tests__/boundaries.spec.ts > module boundaries > flags a deep cross-module import 1004ms
 ✓ src/__tests__/boundaries.spec.ts > module boundaries > allows importing a module's public index 5ms
 ✓ src/__tests__/boundaries.spec.ts > module boundaries > flags core importing any module, even the public index 15ms
 ✓ src/__tests__/boundaries.spec.ts > module boundaries > flags a deep import from app code 5ms
 ✓ src/__tests__/boundaries.spec.ts > the canonical comparator > flags localeCompare in core 28ms
 ✓ src/__tests__/boundaries.spec.ts > the canonical comparator > flags localeCompare in a module 4ms
 ✓ src/__tests__/boundaries.spec.ts > the canonical comparator > allows compareCanonical and a bare sort 5ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts > the cad ingest subprocess > ingests the fixture into the artifact the pipeline committed 450ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts > the cad ingest subprocess > refuses a corrupt drawing by name, never as an empty success 395ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts > the cad ingest subprocess > refuses a drawing that is not there 363ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts > the cad ingest subprocess > refuses rather than hangs when the pipeline outruns its timeout 6ms
```

Their cold counterparts, from the boot verify in section 1 (default reporter, which broke out
the slow files test-by-test):

```
 ✓ src/__tests__/boundaries.spec.ts (7 tests) 983ms
     ✓ flags a deep cross-module import 876ms
 ✓ src/modules/takeoff/__tests__/cad.spec.ts (4 tests) 2315ms
     ✓ ingests the fixture into the artifact the pipeline committed 1644ms
     ✓ refuses a corrupt drawing by name, never as an empty success 326ms
     ✓ refuses a drawing that is not there 334ms
```

`cad.spec`'s fourth test, "refuses rather than hangs when the pipeline outruns its timeout",
has no cold line — the cold reporter listed only the three slow ones. Warm it is 6–15ms, so
its cold cost is unknown but bounded above by the file's 2315ms.

## 5. Supplementary — the missing warm per-file totals

Not requested; recorded because it is the reason the answer above is a per-*test* comparison.
No repair attempted. The default reporter printed all 11 file lines in the cold verify and
none in either warm run:

```
$ pnpm vitest run          # warm, 12:51:20

 RUN  v4.1.10 /home/user/vextrus


 Test Files  11 passed (11)
      Tests  113 passed (113)
   Start at  12:51:20
   Duration  3.48s (transform 467ms, setup 0ms, import 5.18s, tests 2.59s, environment 1ms)
```

The same suppression appears inside step 2's `verify: test` leg (section 1, second run), which
is why that run contributes no per-file numbers to the table. `scripts/verify.mjs` invokes
`pnpm exec vitest run` with no reporter flag, and `vitest.config.ts` sets none, so nothing in
this tree selects the behaviour either way.
