# Bairang ledger

Works in a Bairang episode carry no names. Each invitation to pitch comes with a link, and when it is first opened, this program shows a token, once, to whoever opened it. This ledger keeps which token belongs to which person.

Every entry is locked with drand timelock encryption (the quicknet chain of the League of Entropy, which publishes a numbered round every three seconds) to the round ten years after the entry was written. Nobody can read an entry before then, whoever runs the program included. If the quicknet chain stops before an entry's round, that entry cannot be opened.

Each line of `ledger.jsonl` holds the fingerprint of an invitation link, the kind of entry (`name` or `token`), the drand round at which it opens, and the locked text. The file starts empty.

    npm install
    node ledger.mjs invite "Name"   make an invitation; prints the secret for its link
    node ledger.mjs open <secret>   first opening of a link; prints the token, once
    node ledger.mjs resolve         prints name and token for every entry whose round has passed

Once an entry's round has passed, anyone can read it with `resolve` (this needs network access to drand).

Licence: MIT.

Bairang: https://bairang.koher.app
