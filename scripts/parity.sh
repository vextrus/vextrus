#!/usr/bin/env bash
#
# The parity check: the four legs a provisioned machine must actually pass,
# rather than the four `provision.sh` used to merely claim.
#
#   1. pnpm checkup   — is the machine fit at all (cheap, and it names the fault)
#   2. pnpm verify    — the tree's contract, five stages, uncached
#   3. pnpm test:db   — proves Postgres is genuinely wired: roles, migrations,
#                       tenant seam. The leg most likely to differ between the
#                       compose path and the native-cluster path.
#   4. next dev       — booted, probed for HTTP 200 on :3210, and killed
#
# A separate script and not inline in provision.sh, deliberately: a check you
# cannot re-run without re-provisioning is a check you will stop running. Run it
# by hand any time with `pnpm parity`.
#
# Fail-fast, in this order, because the order is cheapest-and-most-diagnostic
# first: checkup costs ~1.5s and names the broken thing, so spending 40s on
# verify to rediscover "the database is down" is waste.
#
# No leg is skippable and there is no quiet flag. A session that cannot see a
# broken machine is the failure this exists to end.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PORT=3210
failed=""
t0=$SECONDS

step() { echo; echo "parity: --- $1 ---"; }
fail() {
  echo >&2
  echo "parity: FAILED — $1" >&2
  failed="$1"
}

# The legs must run on the PATH a *session* will have, not the provisioner's.
# provision.sh exports Node 24 into its own shell, so a check bolted onto it
# would pass while every session runs the image's Node 22 (ticket 02, fault A).
# provision.sh therefore hands us the PATH it started with; standing alone we
# are already in a session's shell and inherit the right thing.
if [ -n "${PARITY_SESSION_PATH:-}" ]; then
  export PATH="$PARITY_SESSION_PATH"
  echo "parity: running legs on a session's PATH, not the provisioner's"
fi
echo "parity: node $(node -v 2>/dev/null || echo none) at $(command -v node || echo none)"

# --- 1. checkup ---------------------------------------------------------------
# Its exit code is defined as "fit for work" precisely so this can gate on it
# (ticket 03). Notable lines do not fail it, so a Node divergence is reported
# here and does not stop the run.
step "checkup"
pnpm checkup || fail "checkup: the machine is not fit for work (see the lines above)"

# --- 2. verify ----------------------------------------------------------------
# Not weakened to make provisioning faster: no caching, no skipped stage.
if [ -z "$failed" ]; then
  step "verify"
  pnpm verify || fail "verify: the tree's contract does not hold on this machine"
fi

# --- 3. test:db ---------------------------------------------------------------
if [ -z "$failed" ]; then
  step "test:db"
  pnpm test:db || fail "test:db: Postgres is reachable but not correctly wired (roles, migrations or the tenant seam)"
fi

# --- 4. the dev server --------------------------------------------------------
# Boot, probe, kill, leave no listener. A stray dev server is a second writer
# (docs/TRAPS.md), so the teardown is checked as carefully as the boot.
if [ -z "$failed" ]; then
  step "dev server (:$PORT)"

  if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null; then
    fail "dev: something is already listening on :$PORT — cannot prove the boot. Stop it and re-run."
  else
    # setsid so the whole tree lands in one process group: `next dev` spawns
    # children, and killing only the pnpm shim orphans them holding the port.
    log="$REPO/.data/parity-dev.log"
    mkdir -p "$REPO/.data"
    if command -v setsid >/dev/null; then
      setsid pnpm dev >"$log" 2>&1 &
    else
      pnpm dev >"$log" 2>&1 &
    fi
    dev_pid=$!

    code=""
    for _ in $(seq 60); do
      code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null || true)"
      [ "$code" = "200" ] && break
      # A dev server that died is not a dev server that is still starting.
      kill -0 "$dev_pid" 2>/dev/null || break
      sleep 1
    done

    if [ "$code" = "200" ]; then
      echo "parity: dev answered 200 on :$PORT"
    else
      fail "dev: no 200 on :$PORT (last code '${code:-none}') — see $log"
      tail -20 "$log" >&2 || true
    fi

    # Teardown. Group first, then the pid, then anything still on the port.
    kill -TERM "-$dev_pid" 2>/dev/null || kill -TERM "$dev_pid" 2>/dev/null || true
    for _ in $(seq 10); do kill -0 "$dev_pid" 2>/dev/null || break; sleep 1; done
    kill -KILL "-$dev_pid" 2>/dev/null || kill -KILL "$dev_pid" 2>/dev/null || true
    wait "$dev_pid" 2>/dev/null || true

    # Prove the teardown rather than assume it: leaving a listener behind would
    # hand the next session a second writer and a port it cannot bind.
    if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null; then
      fail "dev: a listener survived teardown on :$PORT"
    else
      echo "parity: :$PORT released"
    fi
  fi
fi

# --- verdict ------------------------------------------------------------------
elapsed=$((SECONDS - t0))
echo
if [ -n "$failed" ]; then
  echo "parity: NOT ok after ${elapsed}s — $failed" >&2
  exit 1
fi
echo "parity: ok in ${elapsed}s — checkup | verify | test:db | dev (:$PORT) all pass"
