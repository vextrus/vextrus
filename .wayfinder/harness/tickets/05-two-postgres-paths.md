# Two Postgres paths — does the cloud pin one?

wayfinder:grilling
Status: closed
Claimed by:
Blocked by: 02-the-cold-machine.md

## Objective

`scripts/provision.sh` has two ways to put Postgres on 5544 — compose when a Docker daemon
exists, a native `pg_ctlcluster` cluster when it does not. Decide whether both stay, and what
makes them equivalent enough that a session cannot tell which one it got.

## What forced it

The branch was written because two consecutive cloud images differed in Docker availability, so
detection was the safe move under uncertainty. But it means the environment has two
implementations of its most load-bearing dependency, and **this machine only ever takes one of
them** — the Docker path. The native path has no regular exerciser at all, which is the same
unfalsifiability problem the cold-machine ticket exists for, one level down.

They are already not identical: compose brings its own image and version, the native path takes
whatever `apt-get install postgresql` yields; compose carries whatever `compose.yaml` configures,
the native path gets a distro default with one `sed` on the port. Extensions, locale, collation
and version can all differ, and any of those can produce a difference the register would feel.

## The question

- **Keep both, and define the equivalence** — what must match for a session not to care
  (major version, extensions, encoding/collation, the roles `db:migrate` expects), and how that
  is checked rather than hoped. `pnpm doctor` is the natural place to check it.
- **Pin the cloud to one path.** If sandbox Docker is reliably present, the native branch is dead
  code that will rot; if reliably absent, the compose branch never runs in the cloud and the two
  environments genuinely differ. Ticket 02's facts decide which of these is true — that is why
  this ticket is blocked on it.
- **Make the local machine take the native path sometimes**, so the branch has an exerciser.
  Cheap to say, unpleasant on Windows; probably rejected, but it should be put.

The thing not to do is leave two paths whose difference is discovered by a wrong quantity.

## Exit criteria

- [ ] The ruling in `## Resolution`: how many paths survive, and for each survivor, what proves
      it works and how often that proof runs.
- [ ] If both survive: the equivalence properties named explicitly, and checked — by `pnpm doctor`
      or by a test, not by prose.
- [ ] If one is dropped: it is *deleted* from `provision.sh`, not left behind a flag.
- [ ] Whichever path the cloud takes has been run cold and passed the ticket-04 bar.
- [ ] `pnpm verify` green.

## Guardrails

- Whatever is decided, `pnpm db:migrate` stays the only schema writer (ADR-0002). Neither path
  may create `vextrus_app` / `vextrus_auth` itself.
- The port stays 5544 on both paths — TRAPS already records that proving *which* database you are
  in is a real failure mode, and two conventions would make it worse.
- Do not decide by preference. Ticket 02 produced facts about what the sandbox actually has;
  the ruling answers to those.

## Facts from [The cold machine](02-the-cold-machine.md) — 2026-08-12

This ticket's premise that "this machine only ever takes one of them — the Docker path" is
**overturned for the cloud**. A cloud sandbox on 2026-08-12 had the Docker *binary* at
`/usr/bin/docker` and **no daemon** (`/var/run/docker.sock` absent), so it took the native
branch. Presence of the binary says nothing about the daemon; `docker info` gets this right
where `command -v docker` would have hung.

The native branch therefore **has an exerciser now, and it passed**: Postgres 16 (already in the
image — `apt-get` was skipped), cluster `16/main` sed'd to port 5544, listening on
`127.0.0.1:5544` only, roles and 18 migrated tables correct, and `pnpm test:db` green at 46
tests against it.

What this sharpens rather than settles: the third option ("make the local machine take the
native path sometimes") is now the *inverse* problem — it is the **compose** path that has no
cloud exerciser. And the sandbox is not reliably one or the other: this image had the binary
without the daemon, an earlier one was recorded simply as "Docker present". Cloud Docker
availability is not a constant, so "pin the cloud to one path" must answer to that.

## Resolution — 2026-08-12

**Both paths survive.** The equivalence is five properties, pinned where they can be pinned and
gated by `pnpm checkup`. Neither branch is deleted; neither is behind a flag.

### Why not a pin

The ticket's second option — pin the cloud to one path — failed its own precondition. It was
written expecting ticket 02 to show sandbox Docker *reliably* present or *reliably* absent.
Three observations now read: **present**, **binary-no-daemon**, **binary-no-daemon** (this
session's container, `/usr/bin/docker` with no `/var/run/docker.sock`). Cloud Docker is not a
constant, so pinning to compose means the cloud cannot provision on the image it actually gets
today, and pinning to native means deleting what every dev machine and `compose.yaml` run.

The exerciser worry that motivated the ticket **inverted rather than survived**: native is
exercised by every cloud session, compose by every session on the Windows machine. Both have a
regular exerciser; they are just not the same one. The third option (make the local machine take
the native path sometimes) is therefore unnecessary and was not taken.

### The equivalence set

| Property | native (measured) | compose | ruling |
|---|---|---|---|
| server **major** | 16 | 16 | assert `= 16`; patch drifts freely — it comes from apt or the image |
| encoding | UTF8 | UTF8 | assert `UTF8` |
| **collate / ctype** | `C.UTF-8` | *was* `en_US.utf8` | **pinned to `C.UTF-8` on both** |
| extensions | `{plpgsql}` | `{plpgsql}` | assert nothing beyond `plpgsql` |
| the roles `db:migrate` expects | ✓ | ✓ | already covered by checkup's `roles` line |

Deliberately **excluded**: `TimeZone` (both `Etc/UTC`), `shared_buffers` / `max_connections`
(both image defaults, and nothing in the tree reads them), and patch version (not ours to pin).

### The measurement that forced it

The native cluster is `datcollate = C.UTF-8`, `datlocprovider = c`. The `postgres:16` image
initdb's under `LANG=en_US.utf8`. `C` sorts by byte value, `en_US.utf8` linguistically — so
`ORDER BY mark` over `C1, C10, C2` gives different output on the two paths. That is the ticket's
"difference discovered by a wrong quantity", and it was live.

Two facts found while sizing it **narrowed the blast radius without excusing the divergence**:

- **Ordinals are not assigned by Postgres.** `familyIdentities()` in `src/core/pairing.ts` sorts
  in JavaScript (`signature.localeCompare`, tie-broken by `placementKey`); `register.ts` is its
  only caller. The initial fear — that collation could shift a frozen ordinal — was wrong.
- **No SQL in the tree orders by text.** Every `ORDER BY` found is over `uuid`, `integer` or
  `timestamptz`, checked against live column types. Collation is **inert today**.

Inert is why it is pinned rather than merely watched: it is a loaded gun with the safety on, and
the day someone writes `ORDER BY mark` the two machines silently disagree. `CREATE EXTENSION`
appears in none of the 12 migrations, so the extension axis was empty and is now held empty.

`C.UTF-8` and not `en_US.utf8` for three reasons: it is what the cloud already has, so the pin is
free on the path that runs most often; byte order is stable across libc upgrades, where glibc's
`en_US` collation changed at 2.28 and silently corrupted text indexes in the wild; and a register
whose founding law is deterministic identity must not sort by whichever libc an image carried.

### How each path is pinned, and how each is proven

- **compose** — `POSTGRES_INITDB_ARGS: --locale=C.UTF-8` in `compose.yaml`. `initdb` args apply
  to a *fresh* data directory only, so this costs one `docker compose down -v` on the dev
  machine; the database is a dev database, remade by `pnpm db:migrate`.
- **native** — `CREATE DATABASE ... TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C.UTF-8'
  LC_CTYPE 'C.UTF-8'` in `provision.sh`'s bootstrap. `template0` is what makes the locale
  settable at all; `template1` imposes its own. `pg_createcluster` otherwise inherits the host
  locale, which is exactly the thing not to trust.
- **the check** — one gating `pg profile` line in `pnpm checkup`, the required profile declared
  there and nowhere else. `BROKEN`, so `provision.sh` refuses to say ok.

**Rejected: a `.dbspec.ts` test.** It would fire more often (`test:db` runs on both paths inside
parity), but it crosses the line ticket 03 drew — checkup is about the *machine*, verify and the
tests are about the *tree*. A wrongly-initdb'd cluster would turn a test red, and a red test says
*your code is broken* when the truth is *your database was built wrong*.

**Rejected: making checkup a verify stage** (ADR-0007 fail-closed; ticket 03 already ruled it)
and **running checkup before `pnpm dev`** (a daemon-sensitive probe in front of the most-run
command).

**How often the proof runs — the asymmetry, accepted deliberately.** Native is proven on every
cold cloud container (`provision.sh` → `parity.sh` → `checkup`, unskippable). Compose is proven
only when someone runs `pnpm checkup` or `provision.sh` by hand. That is accepted rather than
closed, because the locale is set by `initdb` at volume creation: a property that can only change
at one rare, deliberate moment does not need continuous proof, and checkup catches it the next
time it runs.

### Proven, not claimed

- `pnpm checkup` on the native path: `[ok] pg profile  PostgreSQL 16 · UTF8 · C.UTF-8 · no
  extensions — compose and native agree`.
- The bootstrap SQL was executed standalone against a scratch database and produced
  `C.UTF-8|C.UTF-8|UTF8` — the literal-concatenation form inside `\gexec` works.
- The check was **proven to fail**: against a database built `LC_COLLATE 'C'` with `pg_trgm`
  installed, `[BROKEN] pg profile  locale C/C, want C.UTF-8 · unexpected extensions: pg_trgm`.
  Both scratch databases dropped.
- `pnpm verify` green in **51.2s**.
- `scripts/provision.sh` re-run end to end with the pin in place: **ok**, `parity: ok in 62s —
  checkup | verify | test:db | dev (:3210) all pass` on the native path.

### Left open, and handed on

The cold run of `provision.sh` on this empty container **failed parity — for a reason that is not
this ticket's**. It took the native branch, brought Postgres up on 5544 and migrated clean, then
`pnpm verify` failed one test: `cad.spec.ts > ingests the fixture into the artifact the pipeline
committed`, timed out at **5008ms against a 5000ms budget**. Warm, the same test passes in
**1.24s**. That is first-`uv run`-in-a-cold-container cost brushing a test timeout — the cold
path fails parity on a coin flip. Recorded here because this session found it; it belongs to the
cold-machine line, not to the Postgres paths.

Consequently the exit criterion "whichever path the cloud takes has been run cold and passed the
ticket-04 bar" is met **for the database**: the native path provisioned, migrated and passed
`checkup`, `test:db` and the dev-server probe cold. The full parity gate did not go green cold,
for the cad-timeout reason above.

**Handed on — [The locale in the sort](11-the-locale-in-the-sort.md):** `pairing.ts` sorts with `localeCompare` and no explicit locale, so
its order depends on the Node runtime's default ICU locale — a cross-machine parity hazard of
exactly the kind this effort exists for, one layer above the database and outside this ruling.
