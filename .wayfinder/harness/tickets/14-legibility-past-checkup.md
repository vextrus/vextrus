# Legibility past `pnpm checkup`

wayfinder:grilling
Status: open
Claimed by:
Blocked by:

## Objective

`checkup` answers *"is this machine fit?"* in one place, cheaply. Decide what is still illegible
once a session is past that question and inside the work — and where the answer belongs, since
this effort's standing preference is to retire prose into mechanism rather than write more prose.

## What forced it

Legibility is half the destination, and `checkup` only covers arrival. Two gaps are already named
by closed tickets, and neither has a home:

- **`storageRoot()` should own its own exists-and-writable check.** Ticket 03 cut a storage-root
  line from `checkup` on the grounds that the failure belongs at the failure site, not in a
  machine probe — the caller knows what it was trying to write and why. Nothing has since given it
  that check, so the cut left a hole rather than moving the mechanism.
- **Dev-server logs a session cannot read.** A session that starts `next dev` owns a background
  shell it cannot easily tail, so a runtime fault in the running app is invisible to the very
  agent debugging it. `parity.sh` already solved a narrow version for itself — it redirects to
  `.data/parity-dev.log` and tails 20 lines on failure — but that is the gate's private
  arrangement, not something a session working normally inherits.

## The question

Where does a session lose the thread, and what mechanism gives it back?

1. **Failure sites that know more than they say.** `storageRoot()` is the named one. Are there
   others — the migration runner, the tenant seam, `runCadIngest`'s refusal channel — where the
   error text names *what* failed but not *what to do*? The governing sentence demands a reason;
   this asks whether the reason is actionable.
2. **The running app.** Should `pnpm dev` write a log a session can read by default, on the
   `parity.sh` pattern? Or is a session that needs app logs already doing something the workspace
   should make explicit?
3. **What `checkup` must NOT absorb.** It is 1.3s and nine lines because it refused to become a
   dumping ground; ticket 03 cut the storage root and system Python for exactly that reason.
   Anything decided here should land at its failure site or in its own command, and the burden is
   on adding to `checkup`, not on keeping it small.
4. **Whether `docs/TRAPS.md` has entries left to retire.** Ticket 03 cut one and trimmed three,
   keeping only those whose value is a cause or a signature. Re-read what remains: each surviving
   entry is a question the environment still answers in prose.

## Guardrails

- Retire traps into mechanism; do not write more prose. A new TRAPS entry is the outcome of last
  resort, and needs a reason why no mechanism could carry it.
- A descriptive line never touches an exit code (ticket 07's `INFO` rule).
- Do not re-litigate what `verify`'s stages check — that is out of scope for this effort.
