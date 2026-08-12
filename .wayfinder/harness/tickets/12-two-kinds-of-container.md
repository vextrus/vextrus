# Two kinds of container, and no way to tell which one you got

wayfinder:grilling
Status: closed
Claimed by:
Blocked by:

## Objective

A cloud session lands on one of two machines. Decide whether that divergence is worth closing,
worth detecting, or worth only documenting — and what a session should do on arrival.

## What forced it

[The gate runs cold](09-the-gate-runs-cold.md) used five containers and found two kinds:

**Empty.** Container #5: rootfs stamped `12:47:05`, and every artefact of provisioning *newer* —
`.env` `12:47:19`, `cad/.venv` `12:47:35`, `node_modules` `12:47:57`. It provisioned itself at
boot, unattended, in ~83s, downloading Node from nodejs.org and creating the cluster, roles and
schema from nothing. `parity: ok in 57s`. This is the machine the map's Notes describe, and the
install path is proven green on it at `c78979b`.

**Snapshot-restored.** Ticket 09's own session: rootfs `12:15:52`, but `node_modules`, `.env`,
`cad/.venv`, a Node 24 install and a Postgres cluster already configured for 5544 all stamped
`10:37–10:38` — an image layer built by an earlier session, at a commit **predating ticket 08**.
It arrived **unfit**: `pnpm checkup` exit 1, nothing listening on 5544, and the session's PATH
resolving Node **v22.22.2** against `engines >=24`, because that image never had the shadow
applied. `provision.sh` repaired both in 38s, exactly as ticket 08 designed — but only because
something ran it.

Nothing announces which kind you have. The only tell is comparing file mtimes against `/`, which
no session will think to do.

## The question

Three candidate rulings, and the grilling should not assume the first:

1. **Close the divergence.** Make a snapshot-restored container indistinguishable from an empty
   one — but the snapshot is the platform's, not ours, and a provisioner that wipes what it finds
   contradicts ticket 08's *"probe, never trust a marker"* and its idempotence guarantee.
2. **Detect and report.** `checkup` already describes the machine under `INFO` (ticket 07/08).
   A line naming which kind of container this is — and, on a snapshot, how stale the image is
   against the current head — costs nothing and gates nothing. Cheapest, and it fits the effort's
   standing preference for mechanism over prose.
3. **Document and move on.** The repair already works and is already named. Perhaps all this needs
   is a sentence, and the real question is who runs `provision.sh` on arrival.

Whichever wins, one sub-question is unavoidable: **a session that starts work on a
snapshot-restored container without provisioning gets a dead database and a Node below the pin.**
`verify` now hard-fails below `engines` (ticket 08), so it refuses rather than lying — that is the
system working. But nothing *routes* a session to the repair before it wastes a turn discovering
it.

## Not yet answered by 09

- **Whether the snapshot ever refreshes.** The image seen here was built at a commit predating
  ticket 08. If snapshots are taken per-environment and never rebuilt, every future session on
  this environment inherits a pre-ticket-08 machine indefinitely, and the shadow is re-applied
  from scratch every time.
- **What the loop would do with this.** A campaign that seizes a machine assumes a known start
  state; two possible start states is a preflight question (`docs/specs/loop.md`).

## Folded in from the map's fog

**Provisioning wall-clock as a target rather than a consequence.** The numbers are now in hand and
they differ *by container kind*, which is why this lives here: **~83s** for an empty container that
downloads Node and builds everything (`parity: ok in 57s`), **38s** for a snapshot-restored one
being repaired, **52s** for a re-run with egress blocked and no download (ticket 08). What is
unstated is the *target*, and whether a full parity gate on every re-run is the right price for
"re-running is the repair" — a question that reads differently for a machine being provisioned
than for one being repaired mid-session.

## Guardrails

- Do not weaken `provision.sh` to force the install path to run. If it is skipped, it is skipped
  for a true reason, and ticket 09 proved the skip is correct.
- `checkup` describes under `INFO` and judges under `BROKEN`; a container-kind line describes. It
  must not touch the exit code (ticket 07).

## Resolution

**2026-08-12 — the subject was never the divergence; it was that nothing invokes the repair.**

The session that closed this ticket landed on the snapshot kind and measured it before asking
anything:

```
/              2026-08-12 16:18:07     ← this container booted
node_modules   2026-08-12 10:38:00     ← the same 10:37–10:38 image ticket 09 saw
.env / .data   2026-08-12 10:37:47
node -v        v22.22.2   (/opt/node22/bin/node ahead of /usr/local/bin — shadow unapplied)
.data/provision.log — absent
HEAD           4c93bab (ticket 10 landed)
```

That settles two of the questions 09 left open, by observation rather than argument:

- **The snapshot never refreshes.** Byte-for-byte the same image layer, four tickets and six
  hours later, still at a commit predating ticket 08.
- **`provision.sh` does not run on a snapshot restore.** No log, and the shadow unapplied — if the
  setup field had fired, Node 24 would have won the PATH. The cloud "Setup script" runs when a
  container is *created*, and the platform's own hook guidance states that container state is
  cached after that hook completes — which is the mechanism that manufactures the second kind in
  the first place.

So the divergence is not two images. It is that **on a restored container nothing invokes the
repair**, and a session's first act is unguarded. `checkup` had been answering the question
correctly and unasked since ticket 03 — on arrival here it printed `database` and `node` BROKEN
with `run scripts/provision.sh` beside them, in 3.8s. The missing part was a caller.

### The ruling

**Route, don't label.** A `SessionStart` hook runs `node scripts/checkup.mjs --hook` before the
session's first turn — on both container kinds and on the Windows checkout — and reports. It never
repairs.

- **Report, not repair.** Repairing in a hook mutates a machine on an arrival nobody chose, and
  pays `parity`'s ~61s (ticket 04) in the least legible place a failure can happen. It would also
  contradict ticket 08's *probe, never trust a marker* posture. `provision.sh` stays a thing a
  session **chose** to run, so its log and its parity result belong to a turn someone can read.
- **Output proportional to the trouble.** Fit prints one line — the INFO environment stamp, which
  is what ticket 07 added it for: `.data/` dies with the container, so a session that carries the
  stamp from turn one can cite any number it later measures. Unfit prints all nine lines and the
  repair, because then every line is evidence.
- **Always exit 0.** SessionStart cannot block a session and must not pretend to. The exit code
  stays the provisioner's (ticket 03); `--hook` is the first consumer that wants the *output* half,
  and that split now has two named readers instead of one.
- **Agent-only routing is accepted.** A hook routes Claude sessions, not a human at a terminal.
  Put explicitly and taken.

### No container-kind line

Ruling 2 of the three (`detect and report`) is **rejected**, though it was the cheap and obvious
one:

- `checkup` already reports every *consequence* of being a snapshot, by symptom and by name, and
  symptoms are what a session acts on. This session needed nothing beyond the two BROKEN lines to
  know exactly what to do. Container kind is a cause where the symptoms already suffice.
- The only available tell is **mtimes compared against `/`** — an inference. Ticket 07 was explicit
  that the environment line is *measured, never inferred*, and a mtime heuristic is precisely the
  guess that rule bans; it would be wrong on the first container anyone `touch`es.
- Ticket 09 already cured the durable half at the class (first-touch materialization → the 60s
  hang net). What remains of "which kind" is trivia.

Ruling 1 (close the divergence) stays rejected for the ticket's own reason — the snapshot is the
platform's, and a provisioner that wipes what it finds contradicts idempotence. Ruling 3 (document)
survives only as this Resolution: the sentence it would have written is the thing the hook now does.

### The loop takes the same gate

`pnpm checkup` becomes the conductor's **first** preflight — the machine cleared before the tree,
using the exit code, the mechanical half. It subsumes the `:3210` probe's purpose while that probe
stays as the second reading for a local dev server. Baseline `verify` stays: checkup asks whether
the *machine* is fit, verify whether the *tree* is green, and a campaign needs both. The gain is
that a campaign launched onto a snapshot refuses in ~1s naming the repair, instead of burning a
full verify to say something true and unhelpful — the ticket-09 failure shape, pre-empted. Invoked
as `node scripts/checkup.mjs`, not `pnpm checkup`: the wrapper adds an `ELIFECYCLE` line that reads
like a second fault. Ships unexercised — there are no arcs yet — and that is accepted for one line
in a preflight list that was already all mechanical refusals.

### Wall-clock: a consequence, not a target

The folded-in fog is ruled **no target**. A budget here would be an unwritten threshold on a number
that provably varies by container kind and by what the machine already holds — and ticket 09 has
just finished deleting exactly that kind of unwritten latency assertion out of vitest. Wall-clock
stays recorded per-run in `.data/provision.log` and quoted into tickets. The number a session now
*feels* is the hook's **1.4s**; the 83s cold path is paid by the platform before any session exists
to be kept waiting. The sub-question — is a full parity gate the right price for "re-running is the
repair"? — is **yes under report-only routing**: paid once, deliberately, by a session that chose
it, and parity is the only thing that proves the repair took. It would have been the wrong price
only in the world where a hook paid it silently on every arrival, which ruling 3 above forecloses.

### Proof

All measured on this container, in this order.

| what | result |
|---|---|
| arrival, unrepaired snapshot | `checkup` exit 1 — `database`, `node` BROKEN, repair named, 3.8s |
| `scripts/provision.sh` as the chosen repair | exit 0, **`parity: ok in 101s`** — checkup \| verify \| test:db \| dev(:3210) |
| `--hook`, fit | one line, `checkup: fit for work (1.4s) — 2026-08-12T16:35:49Z · linux x64 · node v24.19.0 · postgres via native …`, EXIT=0 |
| `--hook`, database genuinely stopped | all nine lines + repair, **EXIT=0** |
| bare `checkup`, same stopped database | **EXIT=1** — the provisioner's half intact |
| `conduct.mjs --dry-run`, same stopped database | refuses in 1.1s naming `scripts/provision.sh`, before `.loop/ACTIVE` or verify |
| database restarted, hook re-run | fit in 1.4s |

The unfit paths were proven by stopping Postgres for real, not by simulation.

### Left behind, on purpose

- **`pg_ctlcluster 16 main start` brought the database back in ~2s.** The fog entry about a native
  Postgres not surviving the process tree assumed the repair was a full `provision.sh` parity gate;
  it is not, and that patch is updated on the map rather than ticketed here.
- **Whether the hook fires in every surface** (headless loop workers, non-Claude tooling) is
  unproven — it cannot be, from inside a session that has already started. First arrival on the
  next fresh container is the test, and a green fit-line at the top of that session's context is
  the pass.
