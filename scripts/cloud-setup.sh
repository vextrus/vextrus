#!/bin/bash
# The cloud environment's SETUP SCRIPT — paste this file's contents verbatim into the
# "Setup script" field at claude.ai/code (docs/agents/cloud-session.md). It is committed here
# so the machine a cloud session gets is reviewed on a diff like everything else; the dialog
# holds a copy, and this file is the source of that copy.
#
# It provisions the VM only — never the checkout. Repo work (deps, .env, migrate, starting the
# cluster) belongs to scripts/cloud-session.sh, which runs on every session including resumed
# ones; this script runs once per environment and its filesystem is then snapshotted, so a
# process it starts does not survive and a file it writes does.
#
# Constraints the platform imposes: runs as root on Ubuntu 24.04, must exit 0 (a non-zero exit
# blocks the session), must finish inside ~5 minutes. Non-critical commands end in `|| true`.
set -u

NODE_MAJOR=24            # package.json engines; the image ships 20/21/22 only
PNPM_VERSION=9.15.1      # package.json packageManager — checkup compares exactly
PG_MAJOR=16              # ADR-0002
PG_PORT=5544             # ADR-0002: native cluster, no Docker, no compose
PG_CLUSTER=vextrus

echo "cloud-setup: node ${NODE_MAJOR}, pnpm ${PNPM_VERSION}, postgres ${PG_MAJOR} on ${PG_PORT}"

# --- Node 24 (nodejs.org is on the Trusted allowlist) --------------------------------------
install_node() {
  local ver
  ver=$(curl -fsSL https://nodejs.org/dist/index.json \
        | jq -r --arg m "v${NODE_MAJOR}." '[.[] | select(.version | startswith($m))][0].version')
  [ -n "$ver" ] && [ "$ver" != "null" ] || { echo "cloud-setup: no Node ${NODE_MAJOR} release found"; return 1; }
  curl -fsSL "https://nodejs.org/dist/${ver}/node-${ver}-linux-x64.tar.xz" -o /tmp/node.tar.xz || return 1
  mkdir -p /opt/node24
  tar -xJf /tmp/node.tar.xz -C /opt/node24 --strip-components=1 || return 1
  # /opt/node22/bin is ahead of /usr/local/bin on the image's PATH, so both are pinned: the
  # login-shell profile wins for shells that read it, cloud-session.sh writes CLAUDE_ENV_FILE
  # for the ones that don't, and the symlinks catch anything that reads neither.
  echo 'export PATH=/opt/node24/bin:$PATH' > /etc/profile.d/vextrus-node24.sh
  /opt/node24/bin/npm install -g "pnpm@${PNPM_VERSION}" || return 1
  for bin in node npm npx pnpm; do ln -sf "/opt/node24/bin/${bin}" "/usr/local/bin/${bin}"; done
  echo "cloud-setup: node ${ver} + pnpm ${PNPM_VERSION} at /opt/node24"
}

# --- Python 3.13 for cad/ (uv is pre-installed; verify's ruff and pytest stages need it) -----
install_python() {
  export UV_PYTHON_INSTALL_DIR=/opt/uv-python
  if uv python install 3.13; then
    echo "cloud-setup: python 3.13 via uv"
    return 0
  fi
  # Fallback when the release-asset fetch is refused: deadsnakes (ppa.launchpad.net is allowlisted).
  add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get install -y python3.13 python3.13-venv \
    && echo "cloud-setup: python 3.13 via deadsnakes"
}

# --- Postgres 16 on 5544, C.UTF-8, owner role `vextrus` with CREATEROLE (ADR-0002) ----------
install_postgres() {
  if command -v pg_createcluster >/dev/null 2>&1; then
    pg_lsclusters 2>/dev/null | grep -q "^${PG_MAJOR} *${PG_CLUSTER} " \
      || pg_createcluster "${PG_MAJOR}" "${PG_CLUSTER}" --port "${PG_PORT}" --locale C.UTF-8 || return 1
    pg_ctlcluster "${PG_MAJOR}" "${PG_CLUSTER}" start || return 1
  else
    # No Debian cluster wrappers: move the packaged cluster onto 5544 instead of adding one.
    sed -i "s/^#\?port *=.*/port = ${PG_PORT}/" "/etc/postgresql/${PG_MAJOR}/main/postgresql.conf" || return 1
    service postgresql restart || return 1
  fi
  # The owner role db-migrate.mjs connects as; CREATEROLE because it creates vextrus_app and
  # vextrus_auth on first run (ADR-0002 consequences). The password is the dev password from
  # .env.example — this cluster is local to the session VM and reachable from nothing else.
  su postgres -c "psql -p ${PG_PORT} -tAc \"SELECT 1 FROM pg_roles WHERE rolname='vextrus'\"" | grep -q 1 \
    || su postgres -c "psql -p ${PG_PORT} -c \"CREATE ROLE vextrus LOGIN CREATEROLE PASSWORD 'vextrus'\"" || return 1
  su postgres -c "psql -p ${PG_PORT} -tAc \"SELECT 1 FROM pg_database WHERE datname='vextrus'\"" | grep -q 1 \
    || su postgres -c "createdb -p ${PG_PORT} -O vextrus -E UTF8 --locale=C.UTF-8 -T template0 vextrus" || return 1
  echo "cloud-setup: postgres ${PG_MAJOR} cluster on ${PG_PORT}, database vextrus owned by vextrus"
}

# --- gh: docs/tracker.md drives every claim, block and PR through it ------------------------
install_gh() {
  apt-get install -y gh && echo "cloud-setup: gh $(gh --version | head -1)"
}

apt-get update -y || true
install_node   || echo "cloud-setup: BROKEN node — pnpm verify will refuse the engines pin"
install_postgres || echo "cloud-setup: BROKEN postgres — pnpm checkup will name it"
install_python || echo "cloud-setup: BROKEN python 3.13 — verify's cad stages will fail"
install_gh     || echo "cloud-setup: note gh absent — the tracker flow needs it"

# Warm the stores so each session's `pnpm install` and `uv sync` are hardlinks, not downloads:
# the snapshot keeps these caches, but never the per-session checkout.
CHECKOUT=$(find /home /workspace /root /mnt -maxdepth 4 -name pnpm-lock.yaml -not -path '*/node_modules/*' 2>/dev/null | head -1)
if [ -n "${CHECKOUT}" ]; then
  REPO=$(dirname "${CHECKOUT}")
  echo "cloud-setup: warming stores from ${REPO}"
  (cd "${REPO}" && /opt/node24/bin/pnpm fetch) || true
  (cd "${REPO}/cad" && uv sync) || true
fi

echo "cloud-setup: done"
exit 0
