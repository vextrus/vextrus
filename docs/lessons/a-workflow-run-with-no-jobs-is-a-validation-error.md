# A GitHub Actions run with no jobs is a workflow validation error — and its log is nowhere

**Summary:** when a run reports `failure` with `jobs: []`, took 0 s, and its `name` is the file
path (`.github/workflows/ci.yml`) instead of the workflow's `name`, the YAML failed validation
before any job was created. `gh run view --log` says "log not found"; the message is only in
the web UI. Read the file for a context used where it is not allowed.

**Observed:** 2026-08-16, issue #68 — first CI run: `runner.temp` in job-level `env`
(`jobs.<id>.env` admits `github`, `needs`, `strategy`, `matrix`, `vars`, `secrets`, `inputs` —
not `runner`). Cost: one failed run and ~10 minutes of API spelunking for a log that does not
exist. The second run failed for a different, visible reason (`astral-sh/setup-uv@v10`: no `v10`
major tag is published, only `v10.0.1`), and that one *did* have a "Set up job" log.

**How it presents:** `gh run list` shows `completed failure … 0s`; `gh api …/runs/<id>/jobs`
returns `[]`; check-runs for the commit carry no annotation.

**Fix:** move the value to a context the job env allows (`${{ github.workspace }}/.data`), and
pin actions to tags that exist (`gh api repos/<owner>/<action>/tags`).
