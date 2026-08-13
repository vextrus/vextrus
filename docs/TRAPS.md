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
- **A clone does not use `.githooks/`.** git reads `.git/hooks`, and `core.hooksPath` is
  repository-local config that no checkout carries — so a committed hook is inert until
  something sets the path, and a hook file without the executable bit is skipped in silence even
  then. 2026-08-12, ticket 16: the pre-push guard had never run on any Linux machine.
  `provision.sh` now sets the path, reads it back, tests the bit, and refuses the provision if
  either did not take; `pnpm checkup`'s git line says which state you are in.
- **GitHub's REST API is not reachable with `curl` from a cloud session** — it answers 403
  *"GitHub access is not enabled for this session"* however the request is spelled, because the
  credential is held by the MCP server and never lands on the machine (ticket 15). Use the
  `mcp__github__*` tools; a polling loop built on `curl` reports nothing forever and looks like
  a hung API. `git` itself is unaffected — its auth is injected in flight by the proxy.
- **PATH order is set by the image, and no file the repo writes is read by a bare `sh -c`.**
  A session's shell is neither a login shell nor an interactive one, so it reads neither
  `/etc/profile.d` nor `.bashrc` — which is how a container putting `/opt/node22/bin` ahead of
  `/usr/local/bin` ran Node 22 while the installed Node was 24, with only pnpm's
  `WARN Unsupported engine` to say so. Corrected, not merely known: `provision.sh` shadows any
  older `node`/`npm`/`npx`/`corepack` ahead of ours (displaced to `<name>.vextrus-displaced`,
  which restores by hand), `pnpm verify` exits 1 below `engines` before stage one, and
  `pnpm checkup`'s node line is BROKEN. The cause is the residue: a PATH you did not set, read
  by a shell that sources nothing.

- **`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` needs `bubblewrap`, which the cloud image does not
  have.** 2026-08-13, ADR-0013's measurements: any nested `claude` invocation dies with
  *"bubblewrap is required for subprocess env scrubbing and isolation"* and a page of minified
  CLI source above it that looks like a crash in the tool. The repo sets the variable in
  `.claude/settings.json` and the Windows workstation has the binary; a cloud container does
  not. Diagnose with `command -v bwrap`.

  **Ruled 2026-08-13 (ticket 18): the dependency is provisioned, not the setting weakened.**
  `scripts/provision.sh` installs bubblewrap on Linux and `pnpm checkup` reports it, so the
  absence is a stated line rather than a fake crash; `conduct.mjs` refuses by name before it
  spawns anything. Measured on a cloud container at `6c6e001`: `apt-get install -y bubblewrap` is
  all it ever needed, and the identical nested session then succeeds **under the scrub**. Do not
  reach for `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=0` — it buys the spawn by silently discarding the
  isolation the repo turned on deliberately, and the setting is enforced only on children, so
  nobody but a spawner can ever notice it is gone.

- **`socat` is the scrub's second dependency since CLI ~2.1.231, and its absence looks like a
  worker that runs but refuses to work.** 2026-08-13, cloud container at `ef91b76`, CLI 2.1.231:
  with bubblewrap 0.9.0 installed and socat absent, the nested `claude -p` session *starts*
  (exit 0, full stream, hooks fire, Write/Edit execute) but **every Bash call** inside it fails
  with *"Sandbox is required but failed to initialize: Sandbox dependencies not available: socat
  not installed. Restart to retry."* — and `dangerouslyDisableSandbox: true` is refused the same
  way under the scrub hardening. Bubblewrap alone sufficed when ticket 18 measured it; the CLI
  moved. It presents as a sandbox crash or a permissions fault in the worker; it is a missing
  package. Diagnose with `command -v socat`; `scripts/provision.sh` installs it beside
  bubblewrap, `pnpm checkup` reports it, and `conduct.mjs` refuses by name before spawning —
  a worker that starts and cannot Bash burns its turns and fails every gate blaming the ticket.

- **Inside a scrubbed worker's Bash, the repo root grows dotfiles that are `/dev/null` in
  disguise — and `next build` dies on them.** 2026-08-13, the first conducted worker (run
  `2026-08-13T17-52-09`, container at `449b7c7`): Tailwind v4's content scanner hit EACCES on
  `.gitconfig`, `.bashrc`, `.idea`, … at the repo root and panicked `next build` — reproduced
  by the worker on a pristine `globals.css`, so it presents as a CSS/build fault in whatever
  was just edited. The files are zero-byte character devices (`crw-rw-rw- 1, 3` — the
  `/dev/null` device) that exist **only inside the nested session's bubblewrap namespace**: the
  scrub masks home-relative dotfiles, and with the workspace as cwd they surface at the repo
  root. From a top-level session the paths do not exist (measured: `stat` says "No such file"
  outside, "character special file" inside the same second), so the fault cannot be reproduced
  where a human would look — and `rm` from inside is refused (it lands in `permission_denials`).
  The standing fix is the worker's: name each one in `.gitignore`, which Tailwind's scanner
  respects; a broad dotfile glob would hide real future files.

- **A scratch clone with a symlinked `node_modules` cannot complete `next build`.** 2026-08-13,
  on a cloud container at `6c6e001`. Cloning the repo and symlinking `node_modules` back to the
  main checkout — the obvious way to stand up a second worktree without a second install — makes
  Turbopack panic: it refuses to resolve modules outside its computed project root, and the two
  paths share no ancestor short of `/`. `typecheck`, `lint`, `test` and the cad stages all pass,
  so it presents as a build-stage fault in the code under test. It is not: it reproduces on a
  stashed, untouched tree, and `next build --webpack` compiles the same tree cleanly.
  `turbopack.root` has no correct value for this layout. Copy `node_modules`, or run a real
  `pnpm install` in the clone.

- **A headless session's `usage` object is not a context size, and it looks exactly like one.**
  2026-08-13, measured on the Windows workstation at `c0cd8f1` with `claude -p` on a two-turn
  prompt: `num_turns` was 2, `usage.iterations.length` was **1**, the top-level read
  `cache_read=23,391` while the sum over `iterations` was `14,065`, and the session's real peak —
  from the message stream — was **14,148**. The top level is *cumulative across the whole session*
  and grows without bound; `iterations` is a *partial* list. Log either as "context" and you get a
  number that means nothing, in the direction that hides a problem (cumulative reads high, so
  everything looks over the line; `iterations` reads low, so nothing does). Peak context needs
  `--output-format stream-json --verbose` and one `usage` per message
  (`scripts/loop/usage.mjs`).

- **A nested worker cannot be spawned with `bypassPermissions`, twice over — and both refusals
  present as a broken worker.** (1) Under uid 0 the CLI refuses it outright: exit 1, *empty
  stdout*, so the run parses as a worker that produced nothing — measured on a cloud container
  at `6c6e001` (every cloud container is root). (2) Since CLI ~2.1.229, any machine where
  `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is set silently *forces the nested session's permission
  mode to default* — measured on the Windows workstation at `63e088a`, stderr: *"Permission mode
  forced to default … Declare allowedTools explicitly"*. So the old spawn line was refused on
  containers and quietly ignored everywhere else. `conduct.mjs` now spawns with
  `--permission-mode dontAsk --allowedTools …` (the CLI's own named repair), and halts by name
  on an empty-stdout worker instead of blaming the ticket. Related: an untrusted workspace
  ignores the *project* allow list ("Ignoring 12 permissions.allow entries"), which is why the
  worker's allow surface lives on the spawn line, not in `.claude/settings.json`.
  **Confirmed on a cloud container at `ef91b76`, CLI 2.1.231 (2026-08-13), with one movement:**
  the ENV_SCRUB forcing now catches *every* mode — `dontAsk` and `bypassPermissions` alike run
  as `default` (the init event says so), so the uid-0 refusal is unreachable wherever the scrub
  is set and the exit-1/empty-stdout shape cannot reproduce there. The surface a worker actually
  has is exactly what the flags carry: `--allowedTools` entries execute (unscoped, so any path —
  workspace trust does not bound them), settings/`--disallowedTools` denies are *pruned from the
  schema* (they never appear in `permission_denials`; the worker sees "no such tool"), and only
  a schema-present, un-allowed, ask-default tool lands in `permission_denials` by name.

- **A nested `claude` writes into its parent's transcript, where it reads as a context collapse
  that never happened.** It inherits `CLAUDE_CODE_SESSION_ID`, so its records land in a file
  named for the *parent's* session — measured on a cloud container at `6c6e001` as an apparent
  fall from 45,620 to 21,486 tokens mid-session. The live stream (`usage.mjs`) is unaffected;
  anything reading `~/.claude/projects/` must deduplicate assistant records by `requestId` (not
  doing so overstated output by ~60%) and drop records from foreign session ids. `conduct.mjs`
  gives every worker its own `--session-id`, which is the documented flag for exactly this.

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
  the server renderer ends up with a null dispatcher. The throw is a shapeshifter — it lands
  wherever the prerender first touches a hook, so the frame it names is never the fault
  (observed as `useContext` of null on `/_global-error` under Node 24 and `length` of null on
  `/` under Node 22: one fault, two stories). The signature is a storm of `unique "key" prop`
  warnings naming `<html>`/`<head>`/`<meta>` just before the throw — only dev React emits
  those, so seeing them during a *build* is the diagnosis. Cure: unset `NODE_ENV` everywhere;
  never set it to force devDependency installation, which is pnpm's default anyway. Verify's
  build stage and `pnpm checkup`'s `NODE_ENV` line both catch it now; what neither can do is
  make the throw look like its cause.

## cad/

- The pipeline is a CLI — there is no service to go stale. If artifacts look wrong, check
  `counters` first: `explode_truncated` and `lost_by_type` exist so ingestion loss is never
  silent. An empty counter set on a dense drawing is suspicious, not reassuring.
