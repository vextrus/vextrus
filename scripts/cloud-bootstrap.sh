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

for d in "$PWD" /workspace/vextrus /workspace/* "$HOME/vextrus" "$HOME"/*; do
  if [ -f "$d/scripts/provision.sh" ]; then
    echo "bootstrap: checkout at $d"
    exec bash "$d/scripts/provision.sh"
  fi
done

echo "bootstrap: no checkout containing scripts/provision.sh found" >&2
echo "bootstrap: looked from PWD=$PWD, HOME=$HOME" >&2
ls -la "$PWD" >&2
exit 1
