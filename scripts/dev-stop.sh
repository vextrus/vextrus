#!/usr/bin/env bash
#
# `pnpm dev:stop` — the other half of `dev:bg`. A server left running is a
# second writer (TRAPS), and the unattended lanes refuse while :3210 is held,
# so leaving a stop to be improvised is leaving a trap.
#
# Kills the process group `dev:bg` recorded, then proves the port is free
# rather than assuming the signal landed.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PORT=3210
PIDFILE="$REPO/.data/dev.pid"

if [ ! -f "$PIDFILE" ]; then
  echo "dev:stop: no $PIDFILE — nothing this script started."
  if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null; then
    echo >&2 "dev:stop: but :$PORT is held by something else — 'pnpm checkup' names the pid."
    exit 1
  fi
  exit 0
fi

dev_pid="$(cat "$PIDFILE")"
kill -TERM "-$dev_pid" 2>/dev/null || kill -TERM "$dev_pid" 2>/dev/null || true
for _ in $(seq 10); do kill -0 "$dev_pid" 2>/dev/null || break; sleep 1; done
kill -KILL "-$dev_pid" 2>/dev/null || kill -KILL "$dev_pid" 2>/dev/null || true
rm -f "$PIDFILE"

if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo >&2 "dev:stop: a listener survived teardown on :$PORT — 'pnpm checkup' names the pid."
  exit 1
fi
echo "dev:stop: :$PORT released"
