#!/usr/bin/env bash
#
# Bring an empty machine to the point where `pnpm verify`, `pnpm test:db` and
# `pnpm dev` all work. Idempotent: safe to re-run, and re-running is the repair.
#
# Used by cloud sandboxes (whose setup field holds only a bootstrap that locates
# this file and execs it — see docs/TRAPS.md and .wayfinder/harness/) and usable
# by hand on a fresh local checkout.
#
# It detects rather than assumes: two consecutive cloud images differed in Docker
# availability and system Python. Postgres comes from compose.yaml when a Docker
# daemon exists — the same source of truth as a dev machine — and from a native
# cluster on the same port 5544 when it does not.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
echo "provision: repo at $REPO"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  as_postgres() { su postgres -c "$*"; }
else
  SUDO="${SUDO:-sudo}"
  command -v sudo >/dev/null || SUDO=""
  as_postgres() { $SUDO -u postgres sh -c "$*"; }
fi

# --- Node 24 (package.json engines) ------------------------------------------
# Cloud images ship Node 22 on PATH, so every pnpm call prints Unsupported
# engine. nvm's default alias only helps shells that source nvm.sh, which a
# non-interactive session shell does not — hence profile.d *and* bashrc *and*
# symlinks, covering login, interactive, and bare `sh -c` respectively.
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 24 ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null && nvm alias default 24 >/dev/null

  NODE24_BIN="$(ls -d "$NVM_DIR"/versions/node/v24.*/bin 2>/dev/null | sort -V | tail -1)"
  if [ -n "$NODE24_BIN" ]; then
    export PATH="$NODE24_BIN:$PATH"
    if [ -w /etc/profile.d ] || [ -n "$SUDO" ]; then
      echo "export PATH=\"$NODE24_BIN:\$PATH\"" | $SUDO tee /etc/profile.d/vextrus-node.sh >/dev/null
    fi
    grep -q vextrus-node24 "$HOME/.bashrc" 2>/dev/null ||
      echo "export PATH=\"$NODE24_BIN:\$PATH\"  # vextrus-node24" >> "$HOME/.bashrc"
    for b in node npm npx corepack; do
      [ -x "$NODE24_BIN/$b" ] && $SUDO ln -sf "$NODE24_BIN/$b" "/usr/local/bin/$b" 2>/dev/null || true
    done
  fi
fi
echo "provision: node $(node -v)"

# --- Postgres on 5544 ---------------------------------------------------------
if docker info >/dev/null 2>&1; then
  echo "provision: docker present — using compose.yaml"
  docker compose up -d postgres
  for _ in $(seq 60); do
    if docker compose exec -T postgres pg_isready -q -U vextrus 2>/dev/null; then break; fi
    sleep 1
  done
else
  echo "provision: no docker daemon — native postgres cluster on 5544"
  if ! command -v pg_ctlcluster >/dev/null; then
    $SUDO apt-get update -qq
    $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
  fi
  PGVER="$(ls /etc/postgresql | sort -V | tail -1)"
  $SUDO sed -i "s/^port *=.*/port = 5544/" "/etc/postgresql/$PGVER/main/postgresql.conf"
  $SUDO pg_ctlcluster "$PGVER" main start || $SUDO pg_ctlcluster "$PGVER" main restart
  for _ in $(seq 60); do
    if as_postgres "pg_isready -p 5544 -q"; then break; fi
    sleep 1
  done

  # Owner role + database only — matching compose.yaml's POSTGRES_USER/DB.
  # db:migrate creates vextrus_app / vextrus_auth itself (ADR-0002); creating
  # them here would put schema authority in a second place.
  cat > /tmp/vx-bootstrap.sql <<'SQL'
SELECT 'CREATE ROLE vextrus LOGIN SUPERUSER PASSWORD ''vextrus_dev_password'''
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus') \gexec
SELECT 'CREATE DATABASE vextrus OWNER vextrus'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vextrus') \gexec
SQL
  chmod 644 /tmp/vx-bootstrap.sql
  as_postgres "psql -p 5544 -v ON_ERROR_STOP=1 -f /tmp/vx-bootstrap.sql"
fi

# --- .env ---------------------------------------------------------------------
# db:migrate calls process.loadEnvFile('.env'), which *overrides* the ambient
# environment — so a partial .env would blank the connection strings. Write it
# whole, sourcing each value from the environment with the dev default as
# fallback. VEXTRUS_STORAGE_ROOT must be absolute and is only knowable here.
# NODE_ENV is deliberately absent: setting it breaks `next build` (TRAPS).
if [ -f .env ]; then
  echo "provision: .env exists — leaving it alone"
else
  cat > .env <<ENV
DATABASE_URL=${DATABASE_URL:-postgres://vextrus_app:vextrus_app_dev_password@localhost:5544/vextrus}
MIGRATE_DATABASE_URL=${MIGRATE_DATABASE_URL:-postgres://vextrus:vextrus_dev_password@localhost:5544/vextrus}
AUTH_DATABASE_URL=${AUTH_DATABASE_URL:-postgres://vextrus_auth:vextrus_auth_dev_password@localhost:5544/vextrus}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-$(head -c 32 /dev/urandom | base64 2>/dev/null || echo dev-only-secret-rotate-in-prod)}
BETTER_AUTH_URL=${BETTER_AUTH_URL:-http://localhost:3210}
VEXTRUS_STORAGE_ROOT=$REPO/.data/artifacts
ENV
  echo "provision: wrote .env"
fi
mkdir -p "$REPO/.data/artifacts"

# --- Toolchain ----------------------------------------------------------------
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@9.15.1 --activate
pnpm install --frozen-lockfile

# uv owns cad/'s Python: pyproject requires >=3.13 and cloud system Python is
# 3.11, so uv fetches its own interpreter. `pytest` is therefore NOT importable
# from system python3 by hand — verify.mjs shells `uv run`, which is correct.
if ! command -v uv >/dev/null; then
  pip install --user -q uv 2>/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
(cd cad && uv sync --frozen)   # prefetch: sandbox egress may be restricted later

# --- Schema -------------------------------------------------------------------
pnpm db:migrate

echo
echo "provision: ok — pnpm verify | pnpm test:db | pnpm dev (:3210)"
