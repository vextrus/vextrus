# The container that is never empty

wayfinder:task
Status: open
Claimed by:
Blocked by:

## Objective

The install path — an empty pnpm store, a `uv sync` that downloads, a Node download — has not run
at any head since `174ce4c`. Find a way to exercise it that does not depend on the platform
handing us an empty machine, because it no longer does.

## What forced it

[The gate runs cold](09-the-gate-runs-cold.md) set out to run `provision.sh` on an empty container
and could not find one. Four containers were used; all four arrived **snapshot-restored**. The
session's own machine is the clearest case: its rootfs was created at 12:15:52Z, while
`node_modules`, `.env`, `cad/.venv`, a Node 24 install and a Postgres cluster already configured
for 5544 all carry mtimes of 10:37–10:38Z. They came from an image layer built by *some earlier
session's* provisioning run, not from this container.

So on every one of them `pnpm install` said *"Already up to date"*, `.env` was left alone, and the
node phase found v24 present. The install path was never entered. Ticket 09 tried to force it by
wiping the workspace; the permission classifier declined, twice.

This is not a small gap. It is the branch that runs on **every genuinely new machine** — a new
contributor's laptop, a new environment, a rebuilt image — and the branch most likely to have
rotted, because nothing has run it in four commits.

It also inverts the map's Notes. *"The cloud's value is not only capacity — it is disposability"*
assumed a cloud container starts empty. It does not; it starts as a photograph of a machine that
was already provisioned, and one taken **before ticket 08 landed** — which is why a session
arrives with an unshadowed `/opt/node22` and gets Node 22 (`pnpm checkup`: *NOT fit for work —
database, node*).

## The question

Where does an empty machine come from now, and what runs the install path?

Candidates, none yet weighed:

- A fresh environment, provisioned from a base image with no vextrus history — does creating one
  cost anything but a form?
- Wiping inside a container, if the classifier can be satisfied by a narrower command or by a
  script in the repo that names what it removes (`scripts/` is already the place provisioning
  lives).
- A container-in-container: `docker` is present on these images but no daemon has ever been
  reachable, so this is likely dead.
- Accepting that `provision.sh`'s install branch is proven by *documentation and review* rather
  than execution, and saying so plainly instead of implying a cold proof that has not happened.

## Also unresolved by 09

- **A snapshot-restored container is unfit on arrival** — database down, and on the current image
  Node 22. `checkup` catches both and the repair works, but nothing tells a session to run it
  before it starts work. The map's fog on *"a natively-started Postgres does not survive the
  container's process tree restarting"* is the same fault seen from the other side, and now has a
  fourth observation.
- **Whether the gate should notice.** `provision.sh` currently cannot tell "I installed this" from
  "I found this in the image". Ticket 08 ruled that provisioning must *probe, never trust a
  marker*; the probe passes on a snapshot, correctly, and the install path is skipped, correctly.
  Nothing is wrong — but nothing reports that the interesting branch was not taken either.

## Guardrails

- Do not weaken `provision.sh` to make the install path reachable. If it is skipped, it is skipped
  for a true reason.
- A wipe that removes the pnpm store, the uv cache and `cad/.venv` costs real download time on
  every subsequent run. Measure that price before making it routine.
