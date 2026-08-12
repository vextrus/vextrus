#!/usr/bin/env bash
#
# `pnpm dev:bg` — a dev server for a caller that is not sitting at a terminal.
#
# `pnpm dev` writes to whatever shell started it. For a session that means a
# background shell: the output is readable only by the process that spawned it,
# it dies with that shell, and it cannot be pointed at in evidence. So a runtime
# fault in the running app is invisible to the very agent debugging it.
#
# This is a *second command*, not a flag on the first, because the need is
# genuinely different: a human wants a server in their terminal, with Next's
# interactive output and ctrl-C; a session wants a server running and its output
# on disk. Wrapping `pnpm dev` to serve both would put a shim between a human
# and Next's TTY — and a shim that must behave the same on Windows and Linux is
# exactly the divergence this effort exists to kill.
#
# `parity.sh` already did this privately for its fourth leg. This is that
# arrangement, made available to anyone.
#
# Boots, probes :3210 for a 200, prints the log path, and exits leaving the
# server running. Stopping it is the caller's: `pnpm dev:stop`, or kill the PID
# `pnpm checkup`'s port line names.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

PORT=3210
LOG="$REPO/.data/dev.log"
PIDFILE="$REPO/.data/dev.pid"

mkdir -p "$REPO/.data"

# A listener we did not start is a second writer, and starting another one on
# top of it proves nothing (TRAPS: a dev server is a second writer). checkup's
# port line names who holds it.
if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo >&2 "dev:bg: something is already listening on :$PORT — run 'pnpm checkup' to see who holds it, then 'pnpm dev:stop'."
  exit 1
fi

# setsid so the whole tree lands in one process group: `next dev` spawns
# children, and killing the parent alone leaves them holding the port.
if command -v setsid >/dev/null; then
  setsid pnpm dev >"$LOG" 2>&1 &
else
  pnpm dev >"$LOG" 2>&1 &
fi
dev_pid=$!
echo "$dev_pid" >"$PIDFILE"

code=""
for _ in $(seq 60); do
  code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$PORT/" 2>/dev/null || true)"
  [ "$code" = "200" ] && break
  # A dev server that died is not a dev server that is still starting.
  kill -0 "$dev_pid" 2>/dev/null || break
  sleep 1
done

if [ "$code" != "200" ]; then
  echo >&2 "dev:bg: no 200 on :$PORT (last code '${code:-none}') — the log is the diagnosis:"
  tail -n 20 "$LOG" >&2
  kill -TERM "-$dev_pid" 2>/dev/null || kill -TERM "$dev_pid" 2>/dev/null || true
  rm -f "$PIDFILE"
  exit 1
fi

echo "dev:bg: answering 200 on :$PORT (pid $dev_pid)"
echo "dev:bg: log at $LOG — it keeps growing; read it there, not from a shell"
echo "dev:bg: stop with 'pnpm dev:stop'"
