# Legibility past `pnpm checkup`

wayfinder:grilling
Status: closed
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

## Resolution

**The storage-root hole was misdiagnosed by the ticket that cut it, and the correct check is
cheaper than the one it asked for.** Ticket 03 cut a line meaning *exists and writable*. Neither
half survives measurement: a missing root is not a failure at all, because `writeArtifact` →
`resolveRef` → `mkdir(dirname, { recursive: true })` **creates the whole chain, root included**;
and a genuinely unwritable one already throws `EACCES` with the path in it. What was left
unguarded is a third thing — **silent divergence between two roots that both work**. A stale or
mistyped `VEXTRUS_STORAGE_ROOT` writes perfectly to a second artifact tree, and the fault
surfaces days later as an `ENOENT` on a row written under the other root, which reads like
corruption or tampering rather than the configuration error it is. That is the *same* symptom
`storage.ts`'s own doc comment says the absolute-path rule exists to prevent, arriving through a
different door.

So the ruling is **identity, not liveness**: the root is a precondition, never something a
writer conjures. `requireStorageRoot()` runs at the one boundary that creates directories —
segments below the root stay ours to make, the root itself must already exist — and refuses by
naming the consequence, not just the condition. **No per-call `stat`**: `resolveRef` is
untouched, so read paths and escape-refusal cost nothing. `provision.sh:313` already `mkdir -p`s
it, so no provisioned machine notices, and one added spec proves the refusal
(`storage.spec.ts` — "refuses to conjure a root that does not exist").

**Env preconditions were one concept implemented four times.** Measured, not eyeballed:
`core/db.ts:36` and `core/auth.ts:27` held a **verbatim-duplicated `requireEnv`** saying only
`X is not set`, while the two sites carrying `(see .env.example)` were the two someone happened
to hand-write (`storage.ts`, `db-migrate.mjs`). That is drift, not design — and the condition
under which the *next* variable gets the unhelpful message by coin-flip. One `src/core/env.ts`,
both duplicates deleted, the pointer in the shape where the next variable inherits it. A
process-start env schema was **rejected**: it is a second `checkup` living in the app, it
front-loads failure away from the site that knows what it wanted, and it contradicts ticket 03's
grounds for the storage cut.

**The ticket's other two suspects came out clean and were left alone.** `runCadIngest` and
`ingestion.ts` already refuse with the thing, the measurement and the bound
(`upload refused: X is N bytes, over the M-byte upload limit`); the tenant seam's throws
(`runAsSystem requires a reason`, `ingest N cites revision M, which is not in tenant scope`) are
internal invariants whose reader *is* the person who broke it. Manufacturing work at either would
have been prose with a mechanism's alibi.

**The dev server got a second command, not a flag.** `pnpm dev:bg` boots, probes :3210 for a
200, and exits leaving the server running with its output at `.data/dev.log`; `pnpm dev:stop`
kills the process group and **proves the port released** rather than assuming the signal landed.
`pnpm dev` is untouched. Wrapping it was **rejected on parity grounds**: `tee` is not
cross-platform, so a shim would have to sit between a human and Next's interactive TTY and
behave identically on Windows and Linux — introducing exactly the divergence this effort exists
to kill. The consumer is genuinely different (a human wants a server in their terminal; a session
wants one running with its output on disk), which is what makes it a command rather than an
option. This promotes `parity.sh:81`'s private arrangement into the shared one.

**`checkup` absorbed nothing from the above, and exactly one line from the TRAPS pass.** All
three rulings would have *widened what fitness means* — none of parity's four legs touches
artifact storage, and an upload is the first thing that does. The tenth line is `INFO provision`:
last run, verdict, path — or `never run on this machine`. It narrows and widens nothing, because
it reports on **the very act every unfit verdict already names as the repair**; a command that
says "run `scripts/provision.sh`" but cannot say whether that has been attempted is precisely
the illegibility this ticket is about. Verdict parsed from `provision.sh`'s own closing line, so
**"failed" and "did not finish" stay distinct findings**. INFO by construction (ticket 07), so it
cannot gate — a hand-provisioned fit machine has no log, and that is not a fault. It is silent on
the hook's fit path and printed on its unfit one, which is correct: *was this machine ever
provisioned* only becomes a question once something else is broken. Cost **0.0s** — checkup still
runs in **1.0s**.

**TRAPS: one retired, two trimmed to cause and signature, the rest kept.**

- Retired — *"a dev server is a second writer"*. Three mechanisms already say it, and checkup
  says it **verbatim**: `[note] port 3210  held — a dev server is a second writer`. `parity.sh:77`
  hard-refuses on a live listener, and `dev:bg` now refuses too.
- Trimmed — the Node/PATH entry, the longest in the file, most of it narrating a problem ticket
  08 *fixed*. Kept as its cause: a PATH you did not set, read by a shell that sources nothing.
- Trimmed — `NODE_ENV=development`. The two-Node-versions history became the sharper general
  point (**the throw is a shapeshifter; the frame it names is never the fault**) with the
  `unique "key" prop` storm kept as the signature.
- Retired — *"the setup field's transcript reaches no file"*, into the checkup line above.
- Kept unchanged: Windows port reservations (**the durable cure is an administered machine act
  no repo mechanism can perform**), WSL-not-Git-Bash, `\r`, `0xC0000142`, one-writable-checkout,
  `git show` baselines, drift's 500-with-ORM-trace signature, RLS silence,
  Docker-binary-≠-daemon, pnpm built-in shadowing, verify-is-evidence, stack-dependent tests,
  cad counters.

**Net prose is down, and one line was added deliberately.** Retiring the dev-server trap left
`dev:bg` undiscoverable, and a command nobody knows exists is not a mechanism — so `CLAUDE.md`'s
existing `Web: localhost:3210` line names it. That is the retired entry's discoverability moved,
not new prose.

Two facts corrected mid-ticket rather than papered over: `checkup.mjs:151` **already** reports
`connection strings not set for X (see .env.example)` for the three DB URLs, so the env gap was
narrower than the ticket implied (the unify still stands — the *runtime* throw is what a session
hits mid-work, and `VEXTRUS_STORAGE_ROOT` was uncovered). And `provision.sh` **already** creates
the storage root, so ruling (b) had no hole to fill.

Also noted, and left to ticket 15: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are in
`.env.example` but read by no code here — better-auth reads them itself, so an unset one fails
inside a library with a message this repo does not control. It is the least legible env var we
have, and it is the secrets ticket's.

**Proven, not claimed.** `pnpm dev:bg` boot → 200 → log readable → second invocation refused on
the held port (exit 1) → `dev:stop` released it (exit 0). `pnpm verify` green **31.2s**;
`pnpm test:db` **46 tests in 12.6s**; `pnpm checkup` fit in **1.0s** with both INFO lines.
Machine provisioned first — it arrived unfit (Postgres down, Node v22.22.2 against the pin),
`parity: ok in 68s`.
