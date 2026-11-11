#!/usr/bin/env bash
# Makes a Bairang invitation and prints its link: ./invite.sh "Name"
# The name is locked in the public ledger for ten years. It is also put after
# the # in the link, which browsers never send, so that the person's own file
# carries it; the server keeps nothing else.
set -euo pipefail
key=$(sed -n 's/^ADMIN_KEY=//p' ~/Dropbox/secrets/bairang-ledger/env)
link=$(curl -fsS -X POST -H "Authorization: Bearer $key" --data-binary "$1" https://bairang-ledger.myplaceholder.in/invite)
echo "$link#name=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1")"
