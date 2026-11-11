#!/usr/bin/env bash
# Locks an accepted pitch in the Bairang ledger: ./accept.sh TOKEN pitch.txt
# The token and the pitch are locked together for ten years; the entry carries
# nothing that ties it to an invitation until then.
set -euo pipefail
key=$(sed -n 's/^ADMIN_KEY=//p' ~/Dropbox/secrets/bairang-ledger/env)
{ echo "$1"; cat "$2"; } | curl -fsS -X POST -H "Authorization: Bearer $key" --data-binary @- https://bairang-ledger.myplaceholder.in/accept
