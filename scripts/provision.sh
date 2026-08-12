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
# Cloud images ship an older Node on PATH (observed: /opt/node22), so every pnpm
# call prints Unsupported engine.
#
# NOT nvm. Installing it means sourcing nvm.sh — thousands of lines of shell —
# into this `set -euo pipefail` script, and on the 2026-08-12 image that exited 3
# right after the installer finished, taking the whole provision with it. The
# official tarball is a download and an untar: it cannot have an opinion about
# our shell options, it does not edit .bashrc behind us, and it pins a real
# version we can print.
#
# Three questions, deliberately separate (ticket 08). Conflating them is what
# made this phase re-download Node on every run while sessions kept getting the
# image's Node 22:
#
#   1. Is a Node >= the pin already ON THIS MACHINE?  — no network
#   2. If not, fetch one.                             — the only step needing egress
#   3. Make every shell resolve it.                   — unconditional, never inside (2)
#
# Step 3 sits outside the install branch on purpose: a machine that has Node 24
# unpacked but unshadowed could never be repaired by a re-run while the
# treatments lived under `if we just installed`.
phase="node"
NODE_MAJOR="$(tr -dc '0-9' < .nvmrc 2>/dev/null || true)"; NODE_MAJOR="${NODE_MAJOR:-24}"

# The major a given node binary reports, or 0 for "did not answer". Never fatal:
# a binary that will not run is an absence, and absence is a fact we act on.
bin_major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

# "Provisioned" as a testable state — NOT a marker file. A marker is a claim
# about the machine stored beside the machine, and the guardrail on this ticket
# is explicit that a stale marker skipping real work is worse than the download
# it replaces. So the install directory is probed and the binary is asked its
# own version: the thing asserted is the thing measured, and it cannot go stale.
NODE_HOME=""
find_installed_node() {
  local d
  for d in /usr/local/lib/nodejs/node-v"$NODE_MAJOR".*-linux-*/bin; do
    if [ -x "$d/node" ] && [ "$(bin_major "$d/node")" -ge "$NODE_MAJOR" ]; then
      NODE_HOME="$d"; return 0
    fi
  done
  return 1
}

# 1. Already here? Ambient first — an image that ships a new enough Node needs
#    nothing installed, and neither case touches the network.
#    readlink -f, because after a previous run the ambient node may BE one of
#    our shadows: taking the symlink's directory would make NODE_HOME the
#    image's /opt/node22/bin and record that as where Node lives.
AMBIENT_NODE="$(command -v node || true)"
if [ -n "$AMBIENT_NODE" ] && [ "$(bin_major "$AMBIENT_NODE")" -ge "$NODE_MAJOR" ]; then
  NODE_HOME="$(cd "$(dirname "$(readlink -f "$AMBIENT_NODE")")" && pwd)"
  echo "provision: node $("$NODE_HOME/node" -v) already on PATH at $NODE_HOME — nothing to install"
elif find_installed_node; then
  echo "provision: node $("$NODE_HOME/node" -v) already installed at $NODE_HOME — no download"
else
  # 2. Fetch. Reached only when the machine genuinely has no Node >= the pin.
  case "$(uname -m)" in
    x86_64 | amd64) NARCH="x64" ;;
    aarch64 | arm64) NARCH="arm64" ;;
    *) echo "provision: unsupported architecture $(uname -m)" >&2; exit 1 ;;
  esac
  # .tar.xz is smaller, but only if this image can unpack it.
  if command -v xz >/dev/null; then NEXT="tar.xz"; TARFLAG="-xJf"; else NEXT="tar.gz"; TARFLAG="-xzf"; fi

  # Ask the dist index which v24 is current rather than pinning a patch that
  # goes stale in the repo. .nvmrc holds the major (24) and is the source here.
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
  NODE_HOME="/usr/local/lib/nodejs/${NODE_PKG%.$NEXT}/bin"
  [ -x "$NODE_HOME/node" ] || {
    echo "provision: unpacked Node but $NODE_HOME/node is not executable" >&2
    exit 1
  }
fi

# 3. Make every shell resolve it. Unconditional, idempotent, and four treatments
#    because a session shell reads none of the files an interactive one does:
#    profile.d for login shells, .bashrc for interactive, /usr/local/bin symlinks
#    for a bare `sh -c` — and the shadow below, because none of the first three
#    beats a directory the image put ahead of /usr/local/bin.
export PATH="$NODE_HOME:$PATH"
if [ -w /etc/profile.d ] || [ -n "$SUDO" ]; then
  echo "export PATH=\"$NODE_HOME:\$PATH\"" | $SUDO tee /etc/profile.d/vextrus-node.sh >/dev/null
fi
if [ -f "$HOME/.bashrc" ] || [ -w "$HOME" ]; then
  # Rewrite rather than append: the old line may point at a Node we replaced.
  sed -i '/# vextrus-node$/d;/# vextrus-node24$/d' "$HOME/.bashrc" 2>/dev/null || true
  echo "export PATH=\"$NODE_HOME:\$PATH\"  # vextrus-node" >> "$HOME/.bashrc"
fi
for b in node npm npx corepack; do
  [ -x "$NODE_HOME/$b" ] && $SUDO ln -sf "$NODE_HOME/$b" "/usr/local/bin/$b" 2>/dev/null || true
done

# The shadow. A session that reads no profile inherits the container's PATH, and
# on the 2026-08-12 image /opt/node22/bin sits ahead of /usr/local/bin — so the
# symlinks above lose and every pnpm call warns Unsupported engine while the
# provisioner reports success (ticket 02, fault B). There is no PATH file a
# non-login non-interactive shell reads, so the only lever left is the directory
# that precedes us: point its node at ours.
#
# Walked, not hardcoded. `/opt/node22` is a fact about one image and this map's
# note is that images are not stable ground; a hardcoded path would keep
# reporting success on the image that moves it. Walking says what it did.
#
# The displaced binary is moved aside, never deleted — .vextrus-displaced is the
# record of what was there, and restores by hand.
shadow_dir() {
  local dir="$1" b
  for b in node npm npx corepack; do
    [ -e "$dir/$b" ] || continue
    [ -x "$NODE_HOME/$b" ] || continue
    if [ -L "$dir/$b" ] && [ "$(readlink -f "$dir/$b")" = "$(readlink -f "$NODE_HOME/$b")" ]; then
      continue  # already ours
    fi
    if [ ! -L "$dir/$b" ] && [ ! -e "$dir/$b.vextrus-displaced" ]; then
      $SUDO mv "$dir/$b" "$dir/$b.vextrus-displaced" || return 1
    fi
    $SUDO ln -sf "$NODE_HOME/$b" "$dir/$b" || return 1
  done
  return 0
}

shadowed=""
seen=":"
# The SESSION's PATH, not ours — ours already has $NODE_HOME prepended, which
# would make the walk stop at entry one and prove nothing.
IFS=':' read -ra _path_entries <<< "${PARITY_SESSION_PATH:-$PATH}"
for dir in "${_path_entries[@]}"; do
  [ -n "$dir" ] || continue
  dir="$(cd "$dir" 2>/dev/null && pwd)" || continue
  case "$seen" in *":$dir:"*) continue ;; esac
  seen="$seen$dir:"
  # Everything from our own directory onward is ours or behind us.
  [ "$dir" = "$NODE_HOME" ] && break
  [ -x "$dir/node" ] || continue
  major="$(bin_major "$dir/node")"
  [ "$major" -ge "$NODE_MAJOR" ] && continue
  echo "provision: shadowing $dir/node (v$major) -> $NODE_HOME/node"
  shadow_dir "$dir" || {
    echo "provision: cannot shadow $dir — it holds a Node $major that will outrank ours" >&2
    echo "provision: on every session shell, and this script will not report a" >&2
    echo "provision: machine it did not deliver. Make $dir writable and re-run." >&2
    exit 1
  }
  shadowed="$shadowed $dir"
done
[ -n "$shadowed" ] && echo "provision: shadowed:$shadowed"

# The check that matters is not what THIS shell resolves — it exported $NODE_HOME
# above and would pass no matter what. Re-resolve on the session's PATH, in a
# shell that reads no profile, because that is the node a session actually gets.
session_node="$(env -i PATH="${PARITY_SESSION_PATH:-$PATH}" sh -c 'command -v node' || true)"
if [ -z "$session_node" ] || [ "$(bin_major "$session_node")" -lt "$NODE_MAJOR" ]; then
  echo "provision: a session's PATH resolves node to '${session_node:-none}'," >&2
  echo "provision: which is below the pin of $NODE_MAJOR — the shadow did not take." >&2
  exit 1
fi
echo "provision: node $("$session_node" -v) at $session_node (as a session resolves it)"

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
