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

# `set -e` with no reporting turns every fault into a bare exit 1, which is what
# a cloud setup field shows the user. Name the phase, the line and the command,
# so one failed run is a diagnosis instead of a guess.
phase="startup"
done_ok=""
on_err() {
  local code=$? line=$1
  echo >&2
  echo "provision: FAILED in phase '$phase' at line $line (exit $code)" >&2
  echo "provision: command was: ${BASH_COMMAND}" >&2
  exit "$code"
}
trap 'on_err $LINENO' ERR

# ERR is not enough. A *sourced* script that exits takes this one with it without
# tripping ERR at all — observed 2026-08-12, when sourcing nvm.sh under `set -u`
# exited 3 and the log simply stopped. EXIT catches every route out.
on_exit() {
  local code=$?
  if [ -z "$done_ok" ] && [ "$code" -ne 0 ]; then
    echo >&2
    echo "provision: EXITED $code during phase '$phase' — no phase reported it," >&2
    echo "provision: so something this script called exited on its behalf." >&2
  fi
}
trap on_exit EXIT

# The PATH a *session* will have, captured before this script exports Node 24
# into its own shell. The parity check runs the legs on this, not ours: a check
# inheriting the provisioner's PATH would pass while every session runs the
# image's Node 22 (ticket 02, fault A).
PARITY_SESSION_PATH="$PATH"
export PARITY_SESSION_PATH

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# A cold run's output is gone by the time a session can look: the cloud setup
# field's transcript is written to no file on the machine (docs/TRAPS.md). So
# the script keeps its own. Append, never truncate — the failed run before the
# one that fixed it is the interesting one.
mkdir -p "$REPO/.data"
PROVISION_LOG="$REPO/.data/provision.log"
exec > >(tee -a "$PROVISION_LOG") 2>&1
echo "provision: === $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "provision: logging to $PROVISION_LOG"

echo "provision: repo at $REPO"
echo "provision: user=$(id -un) node=$(command -v node || echo none) docker=$(command -v docker || echo none)"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
  as_postgres() { su postgres -c "$*"; }
else
  SUDO="${SUDO:-sudo}"
  command -v sudo >/dev/null || SUDO=""
  as_postgres() { $SUDO -u postgres sh -c "$*"; }
fi

# --- Node 24 (package.json engines, .nvmrc) -----------------------------------
# Cloud images ship Node 22 on PATH (observed: /opt/node22), so every pnpm call
# prints Unsupported engine.
#
# NOT nvm. Installing it means sourcing nvm.sh — thousands of lines of shell —
# into this `set -euo pipefail` script, and on the 2026-08-12 image that exited 3
# right after the installer finished, taking the whole provision with it. The
# official tarball is a download and an untar: it cannot have an opinion about
# our shell options, it does not edit .bashrc behind us, and it pins a real
# version we can print.
#
# The PATH still needs three treatments, because a non-interactive session shell
# reads none of the files an interactive one does: profile.d for login shells,
# .bashrc for interactive, and /usr/local/bin symlinks for a bare `sh -c`.
phase="node"
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 24 ]; then
  case "$(uname -m)" in
    x86_64 | amd64) NARCH="x64" ;;
    aarch64 | arm64) NARCH="arm64" ;;
    *) echo "provision: unsupported architecture $(uname -m)" >&2; exit 1 ;;
  esac
  # .tar.xz is smaller, but only if this image can unpack it.
  if command -v xz >/dev/null; then NEXT="tar.xz"; TARFLAG="-xJf"; else NEXT="tar.gz"; TARFLAG="-xzf"; fi

  # Ask the dist index which v24 is current rather than pinning a patch that
  # goes stale in the repo. .nvmrc holds the major (24) and is the source here.
  NODE_MAJOR="$(tr -dc '0-9' < .nvmrc 2>/dev/null || true)"; NODE_MAJOR="${NODE_MAJOR:-24}"
  NODE_PKG="$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" \
              | grep -o "node-v${NODE_MAJOR}\.[0-9.]*-linux-${NARCH}\.${NEXT}" | head -1 || true)"
  [ -n "$NODE_PKG" ] || {
    echo "provision: could not resolve a Node ${NODE_MAJOR} ${NARCH} build from nodejs.org" >&2
    echo "provision: (network egress blocked at provision time?)" >&2
    exit 1
  }
  # `node-v24.19.0-linux-x64.tar.xz` -> `v24.19.0`; the strip leaves the v on.
  NODE_VER="${NODE_PKG#node-}"; NODE_VER="${NODE_VER%%-linux-*}"
  echo "provision: installing Node $NODE_VER ($NARCH) from nodejs.org"

  curl -fsSL "https://nodejs.org/dist/${NODE_VER}/${NODE_PKG}" -o "/tmp/${NODE_PKG}"
  $SUDO mkdir -p /usr/local/lib/nodejs
  $SUDO tar $TARFLAG "/tmp/${NODE_PKG}" -C /usr/local/lib/nodejs
  rm -f "/tmp/${NODE_PKG}"
  NODE24_BIN="/usr/local/lib/nodejs/${NODE_PKG%.$NEXT}/bin"

  if [ -x "$NODE24_BIN/node" ]; then
    export PATH="$NODE24_BIN:$PATH"
    if [ -w /etc/profile.d ] || [ -n "$SUDO" ]; then
      echo "export PATH=\"$NODE24_BIN:\$PATH\"" | $SUDO tee /etc/profile.d/vextrus-node.sh >/dev/null
    fi
    grep -q vextrus-node24 "$HOME/.bashrc" 2>/dev/null ||
      echo "export PATH=\"$NODE24_BIN:\$PATH\"  # vextrus-node24" >> "$HOME/.bashrc"
    for b in node npm npx corepack; do
      [ -x "$NODE24_BIN/$b" ] && $SUDO ln -sf "$NODE24_BIN/$b" "/usr/local/bin/$b" 2>/dev/null || true
    done
  else
    echo "provision: unpacked Node but $NODE24_BIN/node is not executable" >&2
    exit 1
  fi
fi
# The image's own Node (e.g. /opt/node22/bin) may still sit ahead of us on a
# session's PATH, so this is a check, not a report: a silent Node 22 is the
# fault this phase exists to prevent.
if [ "$(node_major)" -lt 24 ]; then
  echo "provision: node is still $(node -v) at $(command -v node) — PATH not taken" >&2
  exit 1
fi
echo "provision: node $(node -v) at $(command -v node)"

# --- Postgres on 5544 ---------------------------------------------------------
phase="postgres"
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
  PGVER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$PGVER" ] || { echo "provision: postgres installed but /etc/postgresql is empty" >&2; exit 1; }
  $SUDO sed -i "s/^port *=.*/port = 5544/" "/etc/postgresql/$PGVER/main/postgresql.conf"
  $SUDO pg_ctlcluster "$PGVER" main start || $SUDO pg_ctlcluster "$PGVER" main restart
  for _ in $(seq 60); do
    if as_postgres "pg_isready -p 5544 -q"; then break; fi
    sleep 1
  done

  # Owner role + database only — matching compose.yaml's POSTGRES_USER/DB.
  # db:migrate creates vextrus_app / vextrus_auth itself (ADR-0002); creating
  # them here would put schema authority in a second place.
  #
  # The locale is stated rather than inherited. pg_createcluster takes whatever
  # the host's locale is at install time, and compose's image initdb's under
  # en_US.utf8 — so the two paths would sort text differently unless both are
  # pinned. TEMPLATE template0 is what makes LC_COLLATE/LC_CTYPE settable at
  # all: template1 imposes its own. `pnpm checkup` gates on the result.
  cat > /tmp/vx-bootstrap.sql <<'SQL'
SELECT 'CREATE ROLE vextrus LOGIN SUPERUSER PASSWORD ''vextrus_dev_password'''
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vextrus') \gexec
SELECT 'CREATE DATABASE vextrus OWNER vextrus TEMPLATE template0 '
       'ENCODING ''UTF8'' LC_COLLATE ''C.UTF-8'' LC_CTYPE ''C.UTF-8'''
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
phase="env"
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
phase="toolchain"
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@9.15.1 --activate
pnpm install --frozen-lockfile

# uv owns cad/'s Python: pyproject requires >=3.13 and cloud system Python is
# 3.11, so uv fetches its own interpreter. `pytest` is therefore NOT importable
# from system python3 by hand — verify.mjs shells `uv run`, which is correct.
phase="python"
if ! command -v uv >/dev/null; then
  pip install --user -q uv 2>/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
(cd cad && uv sync --frozen)   # prefetch: sandbox egress may be restricted later

# --- Schema -------------------------------------------------------------------
phase="migrate"
pnpm db:migrate

# --- Earn the "ok" ------------------------------------------------------------
# This script used to print "ok" while its exit status reflected only
# db:migrate. A provisioner that says ok without checking is how a session
# begins work on a broken machine and then blames the code.
#
# ERR/EXIT reporting is suspended for this call: parity.sh reports its own
# failing leg by name, and the generic "FAILED in phase" line would bury it.
phase="parity"
set +e
trap - ERR
bash "$REPO/scripts/parity.sh"
parity_status=$?
set -e
if [ "$parity_status" -ne 0 ]; then
  echo >&2
  echo "provision: NOT ok — the machine provisioned but does not pass the parity check." >&2
  echo "provision: re-running this script is the repair; the log is at $PROVISION_LOG" >&2
  exit "$parity_status"
fi

done_ok=1
echo
echo "provision: ok — checkup | verify | test:db | dev (:3210) all proven, not claimed"
