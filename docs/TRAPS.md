# Traps — the instrument lies before the build does

**An environment fault, a stale artifact, or a broken tool almost always presents as a build
fault.** Read this when something is broken and the code looks right. Entries are added only
with a dated, observed cost — never speculatively.

## Windows

- **Windows reserves TCP port ranges dynamically** (Hyper-V/WSL), and the reservations move
  after reboots. 2026-08-12, founding day: port 5433 was inside the reserved 5433–5532 block
  ("access a socket in a way forbidden by its access permissions"), which is why Postgres is
  on **5544**. Diagnose: `netsh int ipv4 show excludedportrange protocol=tcp`. Move the port;
  don't fight the OS. "Failed readiness" says nothing about ports — read the log for `EACCES`.
- **`bash` from PowerShell can be WSL, not Git Bash** — a second toolchain that limps far, then
  dies with exit 127 on any Windows CLI. Launch scripts with the explicit Git Bash path;
  `Start-Process` bypasses aliases.
- **`psql -tAc` output carries `\r`** and silently breaks shell variables built from it.
- **`0xC0000142` / `-1073741502` from node processes** is Windows refusing to initialize
  processes under resource pressure — the tree is fine. Free memory or reboot; "fixing the
  failing package" is the trap.

## Git and the working tree

- **One writable checkout per branch, ever.** Two sessions in one tree corrupt each other's
  index and uncommitted work (observed twice in the legacy repo, once silently reverting and
  pushing 25 files). Never `git add -A` when another session may be live.
- **Read baselines with `git show <sha>:<path>`, never `git checkout <sha> -- <path>`.** Any
  tree-mutating recovery is its own deliberate step, never chained after `;`.
- **A dev server is a second writer.** Stop `pnpm dev` before unattended runs; if :3210 still
  answers, kill the port PID.

## Database

- **Drift presents as an application fault** (500 with an ORM stack trace). First command:
  `pnpm db:drift`. Fix: `pnpm db:migrate` — never hand-applied SQL, which creates state the
  drift checker cannot see.
- **RLS symptoms are silent**: empty result sets, blank screens, no error. Usually a code path
  outside `forTenant`/`runAsSystem`. The seam test (`pnpm test:db`) is the diagnosis tool.
- **Prove which database you're in before theorizing** — a container proxy can own
  `0.0.0.0:5544` while another listener holds `[::1]:5544`.

## Verification

- **Only `pnpm verify` output is evidence.** It runs uncached by design; if a check was run any
  other way (IDE, partial command, memory of a prior run), it is a claim, not a result.
- **Stack-dependent tests stay out of the verify lane** (`pnpm test:db`, Playwright). A live-
  service test inside verify makes green depend on daemons and poisons the contract.

## cad/

- The pipeline is a CLI — there is no service to go stale. If artifacts look wrong, check
  `counters` first: `explode_truncated` and `lost_by_type` exist so ingestion loss is never
  silent. An empty counter set on a dense drawing is suspicious, not reassuring.
