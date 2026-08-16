# `gh` infers the repository from a git remote, which a workflow step may not have

**Summary:** `gh issue comment` / `gh issue edit` resolve the repository from the checkout's git
remote, not from the Actions context. In a job step that runs **before** `actions/checkout` there
is no `.git`, and every `gh` call dies with `failed to run git: fatal: not a git repository`.
`GH_TOKEN` does not help — it authenticates, it does not locate. Set `GH_REPO`.

**Observed:** 2026-08-16, issue #108, run `31941273131`. The dispatcher's gate
(`.github/workflows/agent.yml`) runs before checkout on purpose, so a refused ticket costs no
checkout and no tokens. It correctly detected `SECRET_MISSING` and printed it as a workflow
annotation — then failed to post the comment and failed to remove the label. The smoke issue was
left labelled `ready-for-agent` with no explanation on it: a refusal that could not speak, which
is the one state `CLAUDE.md` condemns. Cost: one failed run and a second smoke cycle.

**How it presents:** the step's `::error::` line is correct and present, and the *next* line is
`failed to run git: fatal: not a git repository (or any of the parent directories): .git`. The job
is red, so nothing is silently wrong in CI — the silence is on the **issue**, where the human
looks.

**Fix:** `GH_REPO: ${{ github.repository }}` in the step's `env`, on every step that calls `gh`
before a checkout. Cheap enough to set on the ones after it too.
