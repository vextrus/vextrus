#!/bin/bash
# The cloud session's bootstrap — SessionStart, ahead of checkup (.claude/settings.json).
#
# A no-op on your machine: it returns before touching anything unless CLAUDE_CODE_REMOTE is
# "true", which only the session VM sets. What it does there is the README's opening block —
# .env, the cluster, dependencies, migrations — because a cloud session gets a fresh clone and
# the environment snapshot keeps caches, never the checkout and never a running process.
#
# It reports and exits 0 whatever happens: checkup speaks last and names what is BROKEN, and a
# session that starts with a named fault beats a session that refuses to start.
set -u

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "${ROOT}" || exit 0
PATH=/opt/node24/bin:${PATH}
export PATH
said=()

# Node 24 and VEXTRUS_STORAGE_ROOT for every later Bash command in this session. The storage
# root is absolute and per-checkout, so it is set here rather than in the environment's
# variables, which cannot know the clone path (cad-ingestion.md: ingest refuses a relative root).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "PATH=/opt/node24/bin:\$PATH"
    echo "VEXTRUS_STORAGE_ROOT=${ROOT}/.data"
  } >> "${CLAUDE_ENV_FILE}"
fi
export VEXTRUS_STORAGE_ROOT="${ROOT}/.data"

# .env — dev values from the one committed env file, with the storage root made absolute here.
if [ ! -f .env ]; then
  sed "s|^VEXTRUS_STORAGE_ROOT=.*|VEXTRUS_STORAGE_ROOT=${ROOT}/.data|" .env.example > .env \
    && said+=(".env written") || said+=(".env FAILED")
fi
mkdir -p "${ROOT}/.data" || true

# The cluster: a snapshot keeps its data directory, never the postmaster (ADR-0002, port 5544).
if ! pg_isready -h localhost -p 5544 -q 2>/dev/null; then
  (pg_ctlcluster 16 vextrus start || service postgresql start) >/dev/null 2>&1
  pg_isready -h localhost -p 5544 -q 2>/dev/null && said+=("postgres started") || said+=("postgres UNREACHABLE on 5544")
fi

# Dependencies: the store is warm from the setup script, so this is a hardlink pass.
if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile >/dev/null 2>&1 && said+=("pnpm install") || said+=("pnpm install FAILED")
fi
if [ ! -d cad/.venv ]; then
  (cd cad && uv sync >/dev/null 2>&1) && said+=("uv sync") || said+=("uv sync FAILED")
fi

# The only schema writer (ADR-0002); it also creates vextrus_app and vextrus_auth on first run.
if pg_isready -h localhost -p 5544 -q 2>/dev/null; then
  pnpm db:migrate >/dev/null 2>&1 && said+=("db:migrate") || said+=("db:migrate FAILED")
fi

[ ${#said[@]} -eq 0 ] || echo "cloud-session: ${said[*]}"
exit 0
