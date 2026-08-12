# Traps — the instrument lies before the build does

**An environment fault, a stale artifact, or a broken tool almost always presents as a build
fault.** Read this when something is broken and the code looks right. Entries are added only
with a dated, observed cost — never speculatively.

## Windows

- **Windows reserves TCP port ranges dynamically** (Hyper-V/WSL), and the reservations move
  after reboots. 2026-08-12, founding day: port 5433 was inside the reserved 5433–5532 block
  ("access a socket in a way forbidden by its access permissions"), which is why Postgres is
  on **5544**. Diagnose: `netsh int ipv4 show excludedportrange protocol=tcp`. "Failed
  readiness" says nothing about ports — read the log for `EACCES`.
  **The durable cure, after the reservation moved onto 5544 too** (2026-08-12, a reboot mid
  ticket 05; compose reported "ports are not available … forbidden by its access permissions"):
  claim the port as an *administered* exclusion, which WinNAT may not take. Elevated
  PowerShell, and `net stop winnat` first or the add fails:

  ```powershell
  net stop winnat
  netsh int ipv4 add excludedportrange protocol=tcp startport=5544 numberofports=1 store=persistent
  net start winnat
  ```

  It then reads `5544  5544  *` in the exclusion list — the `*` is what survives reboots.
  Moving the port instead is the old advice: it works, and you redo it the next time the block
  moves.
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
- **A dev server is a second writer.** Stop `pnpm dev` before unattended runs.

## Database

- **Drift presents as an application fault** (500 with an ORM stack trace). Fix:
  `pnpm db:migrate` — never hand-applied SQL, which creates state the drift checker cannot
  see. `pnpm checkup` reports drift unprompted, so there is no first command to recall.
- **RLS symptoms are silent**: empty result sets, blank screens, no error. Usually a code path
  outside `forTenant`/`runAsSystem`. The seam test (`pnpm test:db`) is the diagnosis tool.

## Sandboxes and provisioning

- **A Docker binary is not a Docker daemon.** 2026-08-12, a cloud sandbox had `/usr/bin/docker`
  on PATH and no `/var/run/docker.sock` at all. Cloud Docker availability is not a constant
  across images — `provision.sh` and `pnpm checkup` both probe it every run and neither
  remembers the answer.
- **The image's Node can outrank the one you installed.** The container puts `/opt/node22/bin`
  ahead of `/usr/local/bin` on PATH, and a session's shell is neither a login shell nor an
  interactive one, so it reads neither `/etc/profile.d` nor `.bashrc`. A session therefore runs
  Node 22 while `/usr/local/bin/node` is 24, and every pnpm call prints
  `WARN Unsupported engine: wanted {"node":">=24"}` — a warning, never a block. Verify is green
  on both, so nothing announces the drift. `node -v` before believing a Node-version symptom.
- **The cloud setup field's transcript reaches no file** — so a session inheriting a
  half-provisioned container cannot read the run that produced it. `provision.sh` therefore keeps
  its own: **`.data/provision.log`**, appended every run. Read that first. If it is absent the
  provisioner never started, which is itself the finding; re-running it is the repair.

## Verification

- **A pnpm built-in silently beats a package script of the same name.** 2026-08-12, ticket 03:
  the workspace check was first called `doctor`, and pnpm 9 has its own `doctor` ("checks for
  known common issues"). It won, printed nothing at all, and exited 0 — indistinguishable from a
  script that ran and found everything fine. The command is now **`pnpm checkup`**; check a new
  script name against `pnpm <name> --help` before adopting it.
- **Only `pnpm verify` output is evidence.** It runs uncached by design; if a check was run any
  other way (IDE, partial command, memory of a prior run), it is a claim, not a result.
- **Stack-dependent tests stay out of the verify lane** (`pnpm test:db`, Playwright). A live-
  service test inside verify makes green depend on daemons and poisons the contract.

## Next.js and the build

- **`NODE_ENV=development` in the environment breaks `next build`.** Next sets `NODE_ENV` per
  command; forcing it makes the production prerender load React's *development* bundles, and
  the server renderer ends up with a null dispatcher. 2026-08-12, a cloud sandbox whose env
  vars set it: `TypeError: Cannot read properties of null (reading 'useContext')` on
  `/_global-error` (Node 24) and `reading 'length'` on `/` (Node 22) — same fault, different
  frame. The tell is a storm of `unique "key" prop` warnings naming `<html>`/`<head>`/`<meta>`
  just before the throw: only dev React emits those, so seeing them during a *build* is the
  diagnosis. `pnpm verify` stayed green throughout — it did not build then; since the ADR-0007
  amendment of the same day it does, and this fault now fails the build stage. Cure: unset `NODE_ENV`
  everywhere; never set it to force devDependency installation, which is pnpm's default anyway.

## cad/

- The pipeline is a CLI — there is no service to go stale. If artifacts look wrong, check
  `counters` first: `explode_truncated` and `lost_by_type` exist so ingestion loss is never
  silent. An empty counter set on a dense drawing is suspicious, not reassuring.
