# An unattended executor that cannot push loses the whole ticket — and the failure is invisible until the end

**Summary:** a dispatched session does all its work in a runner that is destroyed when the job
ends. Nothing is durable until `git push` succeeds. So a permission or token fault on the *push* —
the last step — costs the entire session, not the step: the branch, the commits, the verify runs,
everything. The executor cannot tell it is doomed, because every earlier tool call succeeds. It
discovers the wall after the expensive part is already spent, then burns its remaining turn budget
retrying.

**Observed:** 2026-08-16, `.github/workflows/agent.yml` on two real build tickets, the first two
it was ever pointed at.

| run | ticket | turns | cost | outcome |
|---|---|---|---|---|
| `31960597386` | the rule-set edition | 61 / 60 | $3.15 | `error_max_turns` — table, seed constant, key function and both call sites written, nothing pushed |
| `31961049416` | the quantity-kind vocabulary | 61 / 60 | $4.29 | `pnpm verify` **green twice** (25.1 s, 29.5 s), then nine `git push` denials; `error_max_turns` |
| `31961422168` | the rule-set edition, re-dispatched | — | — | **cancelled** — an unrelated label on another issue took the serial concurrency slot |

`git ls-remote` found no branch from any of them. **$7.44, two correct implementations, zero
lines surviving.** Both tickets returned to the frontier unassigned, which is the dispatcher's
`NO_PULL_REQUEST` guard working exactly as designed — the guard was never the defect.

**How it presents:** the executor reports `Claude requested permissions to use Bash, but you
haven't granted it yet` for `git push` **only**, while `find`, `cat`, `whoami`, `git rev-parse`
and `gh api` all run normally in the same session — so `--permission-mode bypassPermissions` and
`--allowedTools Bash` are plainly in force. Its workaround, building a tree and creating the ref
through the API, returns `Resource not accessible by integration`. Then it retries until the turn
cap.

**Why it regressed rather than never worked:** the same configuration pushed successfully hours
earlier and merged PR #125. Two candidates, unseparated: the action is pinned to
`anthropics/claude-code-action@v1`, a **floating tag** that can change behaviour with no diff in
this repository, and the job declared **no `permissions:` block**, so the token it holds is
whatever the default is that day. Either way the lesson stands: in a repository that pins its
converter, its model and its database, the one workflow permitted to run Claude was the one
dependency not pinned — which also makes every number measured against it unreproducible.

**Fix:** the dispatcher is retired (`genesis-ii.md` §3 Amendment A3, 2026-08-16). The build
session is a human-invoked interactive session, which `harness.md` §3.4 already ruled the correct
answer at this backlog: the pick is seconds, the session is minutes, so automating the pick was
always buying seconds. If it is ever rebuilt: pin the action to a SHA, declare `permissions:`
explicitly, and **prove the push first** — have the executor push an empty commit before it reads
any code, so a publishing fault costs one turn instead of sixty.
