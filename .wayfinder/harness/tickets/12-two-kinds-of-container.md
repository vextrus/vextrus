# Two kinds of container, and no way to tell which one you got

wayfinder:grilling
Status: open
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
