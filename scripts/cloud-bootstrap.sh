#!/usr/bin/env bash
#
# THE CLOUD SETUP FIELD'S CONTENTS — paste this, and nothing else, into the
# sandbox environment's "Setup script" box.
#
# It is here so the one piece of provisioning that cannot live in the repo is at
# least *recorded* in it: when the form and this file disagree, this file is the
# intended text and the form is drift.
#
# Its only job is to find the checkout and hand over to scripts/provision.sh,
# which is versioned, diffable, and fixable from inside a session. Keep it dumb:
# every line added here is a line that can only be debugged through a web form.
set -euo pipefail

# Observed 2026-08-12: the sandbox runs as root with HOME=/root but PWD=/home/user,
# and the checkout at /home/user/vextrus — so $HOME is not where the code is, and
# the children of $PWD matter as much as $PWD itself. Search both, then fall back
# to a bounded find rather than adding another guess to the list.
for d in "$PWD" "$PWD"/* /home/*/vextrus /home/*/* /workspace /workspace/* \
         "$HOME/vextrus" "$HOME"/*; do
  if [ -f "$d/scripts/provision.sh" ]; then
    echo "bootstrap: checkout at $d"
    exec bash "$d/scripts/provision.sh"
  fi
done

found="$(find / -maxdepth 5 -name provision.sh -path '*/scripts/*' \
          -not -path '*/node_modules/*' 2>/dev/null | head -1 || true)"
if [ -n "$found" ]; then
  d="$(cd "$(dirname "$found")/.." && pwd)"
  echo "bootstrap: checkout at $d (found by search)"
  exec bash "$d/scripts/provision.sh"
fi

echo "bootstrap: no checkout containing scripts/provision.sh found" >&2
echo "bootstrap: looked from PWD=$PWD, HOME=$HOME, user=$(id -un)" >&2
ls -la "$PWD" >&2
exit 1
