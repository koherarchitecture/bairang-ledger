# Bairang ledger

Works in a Bairang episode carry no names. Each invitation to pitch comes with a link, and when it is first opened, the server (`server.mjs`) shows a token, once, to whoever opened it. This ledger keeps which token belongs to which person.

Every entry is locked with drand timelock encryption to the round ten years after it was written. drand's quicknet chain, run by the League of Entropy, publishes a numbered round every three seconds. Nobody can read an entry before then, whoever runs the server included. If the quicknet chain stops before an entry's round, that entry cannot be opened.

Each line of `ledger.jsonl` holds the fingerprint of an invitation link, the kind of entry (`name` or `token`), the drand round at which it opens, and the locked text.

`server.mjs` is the only writer. It makes an invitation (the name is locked on arrival and never stored unlocked), shows a token the first time a link is opened, and commits each entry here. The server keeps no log, and the proxy in front of it keeps no access log. `ledger.mjs` does the locking and the reading.

Once an entry's round has passed, anyone can read it (this needs network access to drand):

```
npm install
node ledger.mjs resolve
```

Licence: MIT.

Bairang: https://bairang.koher.app
