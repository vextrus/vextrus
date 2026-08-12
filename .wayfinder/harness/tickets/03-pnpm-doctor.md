# `pnpm doctor` — what the workspace must report about itself

wayfinder:grilling
Status: closed
Claimed by:
Blocked by: 02-the-cold-machine.md

## Objective

Decide what a workspace must be able to say about itself, and build the one command that says it.
The convergence point for the legibility axis: a session that is *suspicious* has somewhere to
look, and provisioning has something to earn its "ok" against.

## What forced it

Nearly every entry in `docs/TRAPS.md` is a question the agent could not answer cheaply, so a
human answered it once and wrote it down: which database am I actually in; is the schema drifted;
is a dev server holding the port; is `NODE_ENV` poisoning the build. Prose costs a file read and
correct recall at exactly the moment a session is already confused — and ADR-0007's own principle
is that quality comes from the environment, not from more prompt text.

## The question, stated fairly

Scattered reporting was put and rejected: each failure site explaining itself is precise and adds
no new surface, but it only helps where something already failed, and it leaves a suspicious
session with nowhere to look. One command was chosen because the self-proving parity check the
provisioner needs and the "what is wrong here" command a session needs are the same artifact
pointed in two directions.

What remains to decide:

- **The line list.** The prior: resolved database identity (host, port, database, role, and
  which listener actually owns 5544), drift status, port ownership for 3210, Node/pnpm/uv/Python
  versions against what the repo requires, `NODE_ENV`, storage root existence and writability,
  git identity and branch. Each line must trace to a trap that actually bit — that is the bound
  that keeps this from becoming a dashboard.
- **Exit-code semantics.** Non-zero when something is *wrong*, not when something is merely
  worth knowing. Where the line between "broken" and "notable" falls, and whether there is a
  third state for "cannot tell".
- **Cost.** It must be cheap enough to run on a hunch. If it needs a live database to report on
  the database, what it does when there isn't one — report the absence, never hang.
- **Relationship to verify.** It is *not* a verify stage: verify is the tree's contract and must
  not become sensitive to daemons (ADR-0007, fail-closed). Doctor is about the machine.
- **What retires.** Which `docs/TRAPS.md` entries become mechanism and are cut from the prose,
  and which are irreducibly environmental and stay.

## Exit criteria

- [x] The ruling recorded in `## Resolution`: line list, exit-code semantics, and what doctor is
      explicitly not.
- [x] `pnpm doctor` implemented and run on this machine, output pasted into the resolution.
- [x] Proven to fire: at least one deliberately broken condition (wrong port owner, stopped
      database, or a drifted schema) detected and reported correctly, then reverted.
- [x] The `docs/TRAPS.md` entries it retires actually cut from that file in the same change.
- [x] `pnpm verify` green, duration recorded — doctor must not have crept into the lane.

## Guardrails

- Every line traces to a trap that bit. A line no one needed is a line that will go stale.
- Doctor reports; it does not repair. Repair is `provision.sh`, which is idempotent by design.
- It must not require a live database to run, or it is useless in the case it exists for.

## Resolution

2026-08-12. `scripts/checkup.mjs`, run as **`pnpm checkup`** — nine lines, six probes, one
boolean exit code.

### The ruling

**The exit code is the provisioner's; the output is the session's.** Doctor prints every line
whatever its state, and the exit code answers exactly one question: *is this machine fit for
work right now*, where fit is defined as `provision.sh`'s own claim — `pnpm verify`,
`pnpm test:db` and `pnpm dev` can all run. A line can be loudly marked and still exit 0. A
session is expected to **read** doctor, not test it.

The alternative put and rejected: exit non-zero on anything off-nominal, with `--strict` for the
provisioner. Rejected because on a healthy machine "something is unusual" is true often enough
to train everyone to ignore the code — this machine proves it, sitting at two permanent `[note]`
lines while fully fit.

**A stopped database is unfit.** Verify has no database stage by design, so a machine with
Postgres down can run the whole verification contract green — but two of the provisioner's three
legs cannot start. Rejected: leaving the DB legs notable-only, because that makes doctor's `ok`
weaker than the claim `provision.sh:207` already prints, and ticket 04 would have to build a
second parallel checker. One artifact pointed two directions was the reason this ticket chose
one command.

**There is no third exit state.** "cannot tell" is a per-line judgment — each probe declares
whether failing to measure is itself a fault. An expired DB connect is broken; an expired
`docker info` is notable. Pushing the judgment into each line is what keeps the exit code a
boolean the provisioner can trust.

### The line list

Each traces to a dated `docs/TRAPS.md` entry; the trap is cited in the source beside it.

| Line | Verdict | Trap |
|---|---|---|
| `database` — host, port, db, server version, connecting role, which address family answered, port PID | **gating** | container proxy owning `0.0.0.0:5544` vs `[::1]:5544` |
| `roles` — `vextrus` / `vextrus_app` / `vextrus_auth` connect | **gating** | RLS symptoms are silent; `test:db` needs `vextrus_app` |
| `drift` — shells `db-drift.mjs --json` | **gating** | drift presents as an application fault |
| `port 3210` | notable | a dev server is a second writer |
| `uv` | **gating** | `verify.mjs:26-32` shells `uv run` unconditionally |
| `node` — running vs installed, against `engines` | notable | the image's Node outranks the one you installed |
| `pnpm` | notable | — reported beside Node, gates nothing |
| `NODE_ENV` | **gating** | `NODE_ENV=development` breaks `next build` |
| `docker` — daemon, not binary | notable | a Docker binary is not a Docker daemon |

The three URLs are compared for agreement **before** any connection: three URLs pointing at two
databases is a configuration fault that would otherwise present as drift-that-isn't.

**Cut.** *Storage root* — `src/core/storage.ts:22-32` already refuses by name on unset and on
relative, with tests pinning both; a doctor line would restate an existing check, and the real
gap (exists-and-writable) belongs in `storageRoot()` beside the two clauses already there, not
in a second reporting surface that can disagree with the first. *System Python* — `uv` owns
cad's interpreter and fetches its own, so this host's 3.11.15 against `requires-python >=3.13`
is a red herring on a healthy machine.

**Deferred.** *Git identity.* It bit (ticket 02: `user.signingkey` into `/home/claude/.ssh/…`
under `HOME=/root`), so it earns a line eventually — but the standard is undecided, and a line
asserting "identity ok" would assert a standard nobody set while the provisioner gates on it.
The secrets/identity fog ticket sets it; the line is cheap to add after.

**Node stays notable, not gating.** Ticket 02 measured all three legs green on 22, so gating
would redden a machine that demonstrably works and make the provisioner unusable before ticket
08 lands. The finding is the *divergence* — `running v22.22.2 but engines wants >=24 —
/usr/local/bin/node is v24.19.0` — because a bare version string hides exactly the trap.
Promotion to gating is a one-word change once 08 fixes PATH ordering.

### Cost

2s hard timeout per probe, sequential, nothing unbounded — an expired probe *is* the finding.
Measured **1.3–1.7s** healthy, **0.8s** with the database down (DB-dependent probes skip rather
than each burning the budget). Drift shells `db-drift.mjs --json` rather than re-implementing:
two drift implementations that can disagree is a worse failure than a ~150ms spawn, and its
0/1/2 exit codes already carry the ok/broken/cannot-tell vocabulary.

### Relationship to verify

Not a stage; verify stays daemon-insensitive (ADR-0007, fail-closed). The only seam is one inert
line on verify's **failure** path — no probe, no daemon, no cost on the green path, exit code and
stage list untouched.

Proven end to end: with `NODE_ENV=development`, verify burns **38s** to fail at the build stage
with a React-internals trace naming nothing about the machine; doctor names the cause in
**1.6s**. That gap is the legibility axis in one measurement.

### Output, on this machine

```
  [ok]     database   vextrus on 127.0.0.1:5544 · PostgreSQL 16.13 · as vextrus
  [ok]     roles      vextrus, vextrus_app, vextrus_auth
  [ok]     drift      schema in sync with db/migrations
  [ok]     port 3210  free
  [ok]     uv         uv 0.8.17
  [note]   node       running v22.22.2 but engines wants >=24 — /usr/local/bin/node is v24.19.0
  [ok]     pnpm       9.15.1
  [ok]     NODE_ENV   unset
  [note]   docker     no daemon reachable — native-Postgres path

doctor: fit for work — verify, test:db and dev can all run (1.3s)
```

### Proven to fire

Three conditions, each reverted:

- **Stopped database** (`pg_ctlcluster 16 main stop`) → `[BROKEN] database  nothing listening on
  localhost:5544 — is it started?`, roles and drift skipped with a named reason, exit **1** in
  0.8s. Cluster restarted, `pg_isready` accepting.
- **`NODE_ENV=development`** → `[BROKEN] NODE_ENV  set to "development" — unset it; it breaks
  next build`, exit **1**.
- **:3210 held** by a listener → `[note] port 3210  held — a dev server is a second writer`,
  exit **0** — notable is not broken, which is the Q1/Q2 ruling holding under test.

### The name — `pnpm checkup`

**`doctor` is a pnpm built-in** ("checks for known common issues"). It shadows the package script
and wins: `pnpm doctor` printed nothing and exited 0, which looks exactly like a script that ran
and found everything fine. The shadowing is now itself a TRAPS entry — it had already bitten
verify's own pointer line, which named the shadowed form on its first outing.

The bare command has to work — a two-word form is a form people get wrong, and this one fails
*silently*, which is the exact failure mode the ticket exists to remove. So the name moved rather
than the invocation: **`pnpm checkup`**, checked free against `pnpm checkup --help` before
adoption (as were `diagnose`, `sitrep`, `health`). `scripts/doctor.mjs` → `scripts/checkup.mjs`;
every reference in TRAPS, the map and verify's pointer moved with it. An intermediate ruling of
`pnpm run doctor` was put and rejected on exactly that ground.

One correction landed with the rename: the first commit's comment on `process.exitCode` blamed
pipe-buffered truncation for the empty output. That diagnosis was wrong — the cause was the
shadowing, found minutes later — and the comment had enshrined it in the source. `process.exitCode`
is still right, for the ordinary reason; the false explanation is gone.

### TRAPS retired

Cut 1, trimmed 3, kept the rest — and said so rather than padding the cut list:

- **Cut:** *"Prove which database you're in before theorizing."* Fully mechanized — the prose said
  go find this out; doctor has already found it out.
- **Trimmed:** drift (dropped "first command: `pnpm db:drift`"), dev server (dropped "kill the
  port PID"), Docker (dropped the `command -v` vs `docker info` diagnostic, kept why the
  provisioner branches).
- **Kept deliberately:** `NODE_ENV` — its value is the *signature* (the `unique "key" prop` storm
  before a null dispatcher), which a status line has no room for. The Node-PATH entry — its value
  is the *cause*, which ticket 08 needs; it retires when 08 lands, not here. Cold-provision-output
  — doctor cannot help; the transcript reaches no file.
- **Added:** the `pnpm doctor` shadowing, dated, with its observed cost.

Rejected: cutting every entry doctor touches. Three of them explain causes and signatures a
status line cannot carry — `NODE_ENV=development [BROKEN]` does not tell you why your build threw
inside React's dispatcher.

### Verify

`pnpm verify` green in **43.5s** (typecheck 10.2 · lint 3.1 · test 4.8 · cad:ruff 0.1 · cad:test
0.9 · build 24.4). Five stages, unchanged — doctor did not creep into the lane.

### Known limitation

`portOwner()` is best-effort and non-gating: this host has no `ss`, so the PID is omitted and the
line still reports occupancy. No build has ever failed because the platform declined to name a
PID, so it is not worth a dependency.
