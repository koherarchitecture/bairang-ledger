// Bairang ledger: which token belongs to which person, locked for ten years.
//
//   node ledger.mjs invite "Name"   make an invitation; prints the secret for its link
//   node ledger.mjs open <secret>   first opening of a link; prints the token, once
//   node ledger.mjs resolve         opens every entry whose time has come; prints name and token
//
// Each entry is locked with drand timelock encryption (quicknet) to the round
// ten years after it is written. Nobody can read it before then, whoever runs
// this program included. The ledger file is public; only the locked text and
// the link's fingerprint are in it. LEDGER sets the file, LOCK_SECONDS the lock
// (both only for testing).

import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { Buffer, mainnetClient, roundAt, timelockDecrypt, timelockEncrypt } from 'tlock-js'

const LEDGER = process.env.LEDGER ?? 'ledger.jsonl'
const LOCK_SECONDS = Number(process.env.LOCK_SECONDS ?? 10 * 365.25 * 24 * 3600)
const client = mainnetClient()
const fingerprint = secret => createHash('sha256').update(secret).digest('hex')
const entries = () => existsSync(LEDGER)
  ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []

async function lock(fp, kind, text) {
  const round = roundAt(Date.now() + LOCK_SECONDS * 1000, await client.chain().info())
  const ciphertext = await timelockEncrypt(round, Buffer.from(text), client)
  appendFileSync(LEDGER, JSON.stringify({ fp, kind, round, ciphertext }) + '\n')
}

const [command, arg] = process.argv.slice(2)

if (command === 'invite') {
  const secret = randomBytes(16).toString('base64url')
  await lock(fingerprint(secret), 'name', arg)
  console.log(secret)
} else if (command === 'open') {
  const fp = fingerprint(arg)
  const kinds = entries().filter(e => e.fp === fp).map(e => e.kind)
  if (!kinds.includes('name')) throw new Error('no such invitation')
  if (kinds.includes('token')) throw new Error('this link has already been opened')
  const token = randomBytes(6).toString('base64url')
  await lock(fp, 'token', token)
  console.log(token)
} else if (command === 'resolve') {
  const now = roundAt(Date.now(), await client.chain().info())
  const people = {}
  for (const e of entries()) {
    if (e.round > now) continue
    people[e.fp] ??= {}
    people[e.fp][e.kind] = (await timelockDecrypt(e.ciphertext, client)).toString()
  }
  for (const p of Object.values(people)) console.log(`${p.name ?? '?'}\t${p.token ?? '(link never opened)'}`)
} else {
  console.log('node ledger.mjs invite "Name" | open <secret> | resolve')
}
