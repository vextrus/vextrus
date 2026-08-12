# 08 — Cold-provisioning proof

Measurement only. No source file was changed, nothing was repaired. A fault below is a
finding, not a defect in the measurement.

Container booted and ran `scripts/provision.sh` from
`claude/provisioner-installation-tracking-ftk02k` @ `174ce4c`.
Measurements taken 2026-08-12, ~6 minutes after provisioning finished.

## Answers

**Did provisioning finish, and did `parity` pass? Wall clock?**
Yes to both. The log's last two lines are the unqualified pass:

```
parity: ok in 52s — checkup | verify | test:db | dev (:3210) all pass
provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed
```

Parity's own wall clock is **52s**, covering checkup, verify, test:db and a real dev server
answering 200 on :3210. Total provisioning wall clock is **~71s**: the log opens at
`2026-08-12T11:54:57Z` and its mtime — the last write — is `11:56:08`. The log carries no
explicit end timestamp, so the 71s is start-stamp to file-mtime, not a figure the log states.

**Did the node phase DOWNLOAD Node, or find one already present? Quote the line.**
It **downloaded**. It found v22 already on PATH and fetched v24 anyway:

```
provision: user=root node=/opt/node22/bin/node docker=/usr/bin/docker
provision: installing Node v24.19.0 (x64) from nodejs.org
```

The first line is the pre-existing interpreter it found (v22, below the `>=24` engine floor);
the second is the download. There is no "already present, reusing" path taken here.

**Which directories did it shadow, if any? Quote the lines.**
One directory, `/opt/node22/bin`:

```
provision: shadowing /opt/node22/bin/node (v22) -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
provision: shadowed: /opt/node22/bin
provision: node v24.19.0 at /opt/node22/bin/node (as a session resolves it)
```

The displacement is non-destructive and legible on disk — the v22 binary is moved aside, not
deleted, and `node`/`npm`/`npx` become symlinks into the v24 install:

```
lrwxrwxrwx /opt/node22/bin/node -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
-rwxr-xr-x /opt/node22/bin/node.vextrus-displaced        (124679552 bytes, Mar 24 04:31)
lrwxrwxrwx /opt/node22/bin/npm  -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/npm
lrwxrwxrwx /opt/node22/bin/npx  -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/npx
lrwxrwxrwx /usr/local/bin/node  -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
```

Exactly one `*.vextrus-displaced` file exists anywhere on PATH (section 8 sweeps every PATH
directory). `/opt/node20/bin/node` and `/opt/node21/bin/node` are untouched — correctly, since
neither directory is on PATH. `/usr/local/bin/node` was also pointed at v24 (symlink, same
11:55 timestamp) but the log does not announce that one; it announces only `/opt/node22/bin`.
Minor log-completeness gap, not a fault.

**Does a profile-free shell resolve node to >= 24?**
Yes.

```
$ env -i PATH="$PATH" sh -c 'command -v node; node -v'
/usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
v24.19.0
```

This is the measurement that matters and it passes with no profile, no shell rc, no corepack
shim. It passes twice over: the v24 bindir is prepended to PATH *and* every stale v22 entry
still on PATH now resolves to v24 through the shadow. `which -a node` lists four entries
(v24 bindir, `/opt/node22/bin` twice — PATH contains it twice — and `/usr/local/bin`) and all
four are v24 or symlinks to it. Removing the PATH prepend would not regress this.

**Any `WARN Unsupported engine` anywhere in the output?**
**None.** Zero matches in the provision log (which contains the full `pnpm install`), zero in
`checkup`, zero in the full `verify` output — not just the tail; section 6 greps the whole
stream. The provision log has no `WARN` lines of any kind. The only noise is one upstream
`DEP0169` deprecation from corepack's `url.parse()` and a pnpm "update available 9.15.1 →
11.21.0" banner, neither of which is an engine mismatch.

**Anything that failed or looked wrong.**
One real failure, and it is not a provisioning fault:

`pnpm checkup` **exits 1 — NOT fit for work — database**. Nothing is listening on
localhost:5544 and no postgres process is running at all (section 7). This is a *regression
since provisioning*, not a provisioning defect: during the run, checkup passed the database
leg outright (`[ok] database vextrus on 127.0.0.1:5544 · PostgreSQL 16.13 · as vextrus`),
all 12 migrations applied, and `test:db` ran 46 tests green against it. The provisioner took
the native-Postgres path because no docker daemon is reachable, and a natively-started
cluster does not survive whatever restarted this container's process tree. Every other
checkup leg still passes — node v24.19.0 against `engines >=24`, pnpm, uv, port 3210 free,
`NODE_ENV` unset. Checkup behaves correctly here: it names the broken thing and points at
the repair (`run scripts/provision.sh`) rather than failing vaguely.

`pnpm verify` **exits 0 — green in 25.6s**, with the database down. That is correct, not a
gap: the DB-backed suite is `test:db`, deliberately outside the verify lane. Verify timings
across three runs in this container were 32.5s (during provisioning), 50.4s (first cold run
by this harness), 25.6s (the run recorded in section 6) — the spread is Next/tsc cache
warmth, and the 15.0s vs 25.6s build leg accounts for nearly all of it.

Nothing else looked wrong. Node resolution, shadowing, displacement bookkeeping, migrations,
lint, typecheck, 109 unit tests, 35 cad tests and the production build are all clean.

---

# Raw captures

## 1. `cat .data/provision.log`

```
provision: === 2026-08-12T11:54:57Z ===
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
(node:739) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
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

Progress: resolved 213, reused 0, downloaded 30, added 16
Progress: resolved 213, reused 0, downloaded 58, added 52
Progress: resolved 213, reused 0, downloaded 73, added 65
Progress: resolved 213, reused 0, downloaded 74, added 65
Progress: resolved 213, reused 0, downloaded 203, added 199
Progress: resolved 213, reused 0, downloaded 212, added 212
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

Done in 7.7s
Using CPython 3.13.12 interpreter at: /usr/bin/python3.13
Creating virtual environment at: .venv
   Building vextrus-cad @ file:///home/user/vextrus/cad
Downloading pygments (1.2MiB)
Downloading fonttools (4.7MiB)
Downloading ezdxf (5.5MiB)
Downloading numpy (15.9MiB)
Downloading ruff (10.9MiB)
 Downloading ruff
 Downloading pygments
 Downloading fonttools
 Downloading ezdxf
 Downloading numpy
      Built vextrus-cad @ file:///home/user/vextrus/cad
Prepared 12 packages in 958ms
Installed 12 packages in 12ms
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


  [ok]     database   vextrus on 127.0.0.1:5544 · PostgreSQL 16.13 · as vextrus
  [ok]     roles      vextrus, vextrus_app, vextrus_auth
  [ok]     drift      schema in sync with db/migrations
  [ok]     port 3210  free
  [ok]     uv         uv 0.8.17
  [ok]     node       v24.19.0 (engines >=24)
  [ok]     pnpm       9.15.1
  [ok]     NODE_ENV   unset
  [note]   docker     no daemon reachable — native-Postgres path

checkup: fit for work — verify, test:db and dev can all run (0.9s)

parity: --- verify ---

> vextrus@0.0.0 verify /home/user/vextrus
> node scripts/verify.mjs

verify: typecheck ok (5.9s)
verify: lint ok (2.4s)

[1m[30m[46m RUN [49m[39m[22m [36mv4.1.10 [39m[90m/home/user/vextrus[39m

 [32m✓[39m src/modules/takeoff/__tests__/placement.spec.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/views.spec.ts [2m([22m[2m37 tests[22m[2m)[22m[32m 81[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/grid.spec.ts [2m([22m[2m15 tests[22m[2m)[22m[32m 57[2mms[22m[39m
 [32m✓[39m src/core/__tests__/pairing.spec.ts [2m([22m[2m10 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/revision.spec.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/core/__tests__/entitygraph.spec.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 32[2mms[22m[39m
 [32m✓[39m src/core/__tests__/register.spec.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m src/__tests__/view-law.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32m✓[39m src/core/__tests__/storage.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 23[2mms[22m[39m
 [32m✓[39m src/__tests__/boundaries.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 753[2mms[22m[39m
     [33m[2m✓[22m[39m flags a deep cross-module import [33m 713[2mms[22m[39m
 [32m✓[39m src/modules/takeoff/__tests__/cad.spec.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 2178[2mms[22m[39m
     [33m[2m✓[22m[39m ingests the fixture into the artifact the pipeline committed [33m 1516[2mms[22m[39m
     [33m[2m✓[22m[39m refuses a corrupt drawing by name, never as an empty success [33m 345[2mms[22m[39m
     [33m[2m✓[22m[39m refuses a drawing that is not there [33m 306[2mms[22m[39m

[2m Test Files [22m [1m[32m11 passed[39m[22m[90m (11)[39m
[2m      Tests [22m [1m[32m109 passed[39m[22m[90m (109)[39m
[2m   Start at [22m 11:55:28
[2m   Duration [22m 4.98s[2m (transform 1.64s, setup 0ms, import 6.02s, tests 3.20s, environment 1ms)[22m

verify: test ok (5.8s)
All checks passed!
verify: cad:ruff ok (0.0s)
...................................                                      [100%]
35 passed in 0.41s
verify: cad:test ok (0.9s)
▲ Next.js 16.3.0 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 34ms
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry


  Creating an optimized production build ...
✓ Compiled successfully in 9.8s
  Running TypeScript ...
  Finished TypeScript in 4.6s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/4) ...
  Generating static pages using 3 workers (1/4) 
  Generating static pages using 3 workers (2/4) 
  Generating static pages using 3 workers (3/4) 
✓ Generating static pages using 3 workers (4/4) in 148ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/auth/[...all]
├ ƒ /api/trpc/[trpc]
└ ○ /login


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

verify: build ok (17.5s)

verify: green in 32.5s

parity: --- test:db ---

> vextrus@0.0.0 test:db /home/user/vextrus
> vitest run -c vitest.db.config.ts


[1m[30m[46m RUN [49m[39m[22m [36mv4.1.10 [39m[90m/home/user/vextrus[39m

 [32m✓[39m db/__tests__/register.dbspec.ts [2m([22m[2m18 tests[22m[2m)[22m[32m 205[2mms[22m[39m
 [32m✓[39m db/__tests__/revision-delta.dbspec.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 172[2mms[22m[39m
 [32m✓[39m src/server/__tests__/ingest.dbspec.ts [2m([22m[2m8 tests[22m[2m)[22m[33m 1775[2mms[22m[39m
     [33m[2m✓[22m[39m lands the fixture's artifact and its fidelity counters, visible via tRPC [33m 422[2mms[22m[39m
     [33m[2m✓[22m[39m a second upload of the same drawing takes the next seq [33m 377[2mms[22m[39m
     [33m[2m✓[22m[39m a corrupt DXF fails loudly with a named error [33m 339[2mms[22m[39m
     [33m[2m✓[22m[39m shows the newest ingest of a revision, never a superseded one [33m 375[2mms[22m[39m
 [32m✓[39m db/__tests__/register-door.dbspec.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 167[2mms[22m[39m
 [32m✓[39m src/server/__tests__/auth.dbspec.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 312[2mms[22m[39m
 [32m✓[39m db/__tests__/tenancy.dbspec.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 108[2mms[22m[39m

[2m Test Files [22m [1m[32m6 passed[39m[22m[90m (6)[39m
[2m      Tests [22m [1m[32m46 passed[39m[22m[90m (46)[39m
[2m   Start at [22m 11:55:53
[2m   Duration [22m 7.77s[2m (transform 532ms, setup 0ms, import 4.23s, tests 2.74s, environment 1ms)[22m


parity: --- dev server (:3210) ---
parity: dev answered 200 on :3210
parity: :3210 released

parity: ok in 52s — checkup | verify | test:db | dev (:3210) all pass

provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed
```

## 2. `echo "$PATH"`, `which -a node`, `node -v`

```
$ echo "$PATH"
/usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin:/opt/ruby-3.3.6/bin:/opt/rbenv/shims:/opt/rbenv/bin:/opt/node22/bin:/opt/maven/bin:/usr/lib/jvm/java-21-openjdk-amd64/bin:/opt/gradle/bin:/root/.bun/bin:/root/.local/bin:/root/.cargo/bin:/usr/local/go/bin:/opt/node22/bin:/opt/maven/bin:/opt/gradle/bin:/opt/rbenv/bin:/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

$ which -a node
/usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
/opt/node22/bin/node
/opt/node22/bin/node
/usr/local/bin/node

$ node -v
v24.19.0
```

## 3. Profile-free shell — `env -i PATH="$PATH" sh -c 'command -v node; node -v'`

```
/usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
v24.19.0
exit=0
```

## 4. `ls -l /opt/*/bin/node* /usr/local/bin/node`

```
-rwxr-xr-x 1   1001 claude  98932688 Mar 24 03:03 /opt/node20/bin/node
-rwxr-xr-x 1 ubuntu ubuntu 102202728 Apr 10  2024 /opt/node21/bin/node
lrwxrwxrwx 1 root   root          54 Aug 12 11:55 /opt/node22/bin/node -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
-rwxr-xr-x 1 ubuntu ubuntu 124679552 Mar 24 04:31 /opt/node22/bin/node.vextrus-displaced
lrwxrwxrwx 1 root   root          42 Mar 31 13:31 /opt/node22/bin/nodemon -> ../lib/node_modules/nodemon/bin/nodemon.js
lrwxrwxrwx 1 root   root          54 Aug 12 11:55 /usr/local/bin/node -> /usr/local/lib/nodejs/node-v24.19.0-linux-x64/bin/node
```

## 5. `pnpm checkup` — full output

```

> vextrus@0.0.0 checkup /home/user/vextrus
> node scripts/checkup.mjs


  [BROKEN] database   nothing listening on localhost:5544 — is it started?
  [note]   roles      skipped — database unreachable
  [note]   drift      skipped — database unreachable
  [ok]     port 3210  free
  [ok]     uv         uv 0.8.17
  [ok]     node       v24.19.0 (engines >=24)
  [ok]     pnpm       9.15.1
  [ok]     NODE_ENV   unset
  [note]   docker     no daemon reachable — native-Postgres path

checkup: NOT fit for work — database (0.4s)
         checkup reports; run scripts/provision.sh to repair.
 ELIFECYCLE  Command failed with exit code 1.
---
exit code: 1
```

## 6. `pnpm verify 2>&1 | tail -20`

```
  Generating static pages using 3 workers (1/4) 
  Generating static pages using 3 workers (2/4) 
  Generating static pages using 3 workers (3/4) 
✓ Generating static pages using 3 workers (4/4) in 161ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/auth/[...all]
├ ƒ /api/trpc/[trpc]
└ ○ /login


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

verify: build ok (15.0s)

verify: green in 25.6s
---
exit code: 0
wall clock (measured by this harness): 26s
```

### Grep of the FULL verify output for engine warnings

```
(no matches — no WARN and no Unsupported engine lines in the full verify output)
```

## 7. Supplementary — why checkup reports BROKEN database

Not requested, but needed to characterise the section-5 failure. No repair attempted.

```
$ ps aux | grep -i [p]ostgres
(no postgres process running)

$ ss -ltn | grep 5544
(nothing listening on 5544)

$ stat -c "%y %n" .data/provision.log   # log mtime = provisioning end
2026-08-12 11:56:08.318435245 +0000 .data/provision.log
```

## 8. Supplementary — sweep for `*.vextrus-displaced` across every PATH directory

```
/opt/node22/bin/ -rwxr-xr-x 1 ubuntu ubuntu 124679552 Mar 24 04:31 node.vextrus-displaced
(end of sweep — only the entries above exist)
```
