# Two Postgres paths — does the cloud pin one?

wayfinder:grilling
Status: open
Claimed by: session 2026-08-12 (claude/two-postgres-paths-8on7nb)
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
