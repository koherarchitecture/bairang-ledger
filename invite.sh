#!/usr/bin/env bash
# Makes a Bairang invitation and prints its link: ./invite.sh "Name"
# The name is locked in the public ledger for ten years; the server keeps nothing else.
set -euo pipefail
key=$(sed -n 's/^ADMIN_KEY=//p' ~/Dropbox/secrets/bairang-ledger/env)
curl -fsS -X POST -H "Authorization: Bearer $key" --data-binary "$1" https://bairang-ledger.myplaceholder.in/invite
