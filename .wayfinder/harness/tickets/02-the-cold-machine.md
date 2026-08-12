# The cold machine — proving the provisioner from zero

wayfinder:task
Status: open
Claimed by:
Blocked by:

## Objective

Run `scripts/provision.sh` on a container that started empty, all the way to a session that can
work, and record every divergence from this machine. The output is a fact list, not a fix list —
later tickets are designed against it.

## What forced it

The provisioner's cold path is unfalsifiable locally. This Windows checkout is already
provisioned, so the only path it can exercise is the idempotent re-run — the path least likely to
be broken. Meanwhile the script's own closing line claims `pnpm verify`, `pnpm test:db` and
`pnpm dev` all work, while its exit code only reports whether `pnpm db:migrate` succeeded. That
claim has never been checked by anything.

Two cloud images already differed in Docker availability and system Python, and a third fault
(`NODE_ENV=development` in the ambient environment) reached a human round-trip before anyone saw
it. Each was found by accident. This ticket finds them on purpose.

## What to do

On a fresh cloud sandbox, from the bootstrap in the setup field through to a working session:

1. `scripts/provision.sh` cold. Capture full output and wall-clock, per phase if it fails.
2. Then, by hand, each leg the script claims: `pnpm verify` (five stages), `pnpm test:db`,
   `pnpm dev` answering HTTP on :3210.
3. Re-run `provision.sh` on the now-provisioned machine — idempotency is a claim too.
4. Record the ambient facts a session cannot see but is affected by: `NODE_ENV` and the rest of
   the inherited environment, Docker daemon present or not, system Python, Node on `PATH` before
   and after, which Postgres path was taken, listener ownership of 5544, git identity, whether
   egress is open at provision time and still open later.

## Exit criteria

- [ ] A cold run performed on a genuinely empty container, its output and timings recorded in
      this ticket's `## Resolution`.
- [ ] Each of the three claimed legs run by hand, pass or fail recorded — a failure here is a
      *result*, not a blocker to closing.
- [ ] The idempotent re-run performed and its behaviour recorded.
- [ ] The ambient-fact list above written down as facts, with local values beside cloud values
      wherever they differ.
- [ ] Any fault that stops the run outright fixed in `scripts/provision.sh` and the cold run
      repeated on a *new* container — a fix verified on the machine it was made on proves nothing.
- [ ] New traps appended to `docs/TRAPS.md` only where the fault is environmental and cannot be
      mechanised; anything mechanisable is handed to `pnpm doctor` instead.

## Guardrails

- Do not fix by hand in the container and call it provisioned. Every fix lands in the repo, and
  the proof is a *new* empty machine.
- Do not weaken the parity bar because a leg is inconvenient in a sandbox. A failing leg is
  recorded as a fact and handed to a later ticket.
- `NODE_ENV` is never set to work around anything (TRAPS, "Next.js and the build").
- The map's Out of scope holds: this is a dev workspace, not a deployment rehearsal.
