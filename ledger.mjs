// Bairang ledger: which token belongs to which person, locked for ten years.
//
// Each entry is locked with drand timelock encryption (quicknet) to the round
// ten years after it is written. Nobody can read it before then, whoever runs
// the server included. The ledger file is public; only the locked text and the
// fingerprint of an invitation link are in it.
//
//   node ledger.mjs resolve   opens every entry whose round has passed
//
// Invitations and tokens are written by server.mjs, the only writer.
// LEDGER sets the file, LOCK_SECONDS the lock (both only for testing).

import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { Buffer, mainnetClient, roundAt, roundTime, timelockDecrypt, timelockEncrypt } from 'tlock-js'

const LEDGER = process.env.LEDGER ?? 'ledger.jsonl'
const LOCK_SECONDS = Number(process.env.LOCK_SECONDS ?? 10 * 365.25 * 24 * 3600)
const client = mainnetClient()
const fingerprint = secret => createHash('sha256').update(secret).digest('hex')
const entries = () => existsSync(LEDGER)
  ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []

// Locks one entry; returns its round and the moment that round is published.
async function lock(fp, kind, text) {
  const info = await client.chain().info()
  const round = roundAt(Date.now() + LOCK_SECONDS * 1000, info)
  const ciphertext = await timelockEncrypt(round, Buffer.from(text), client)
  appendFileSync(LEDGER, JSON.stringify({ fp, kind, round, ciphertext }) + '\n')
  return { round, opensAt: new Date(roundTime(info, round)).toISOString() }
}

// Makes an invitation: locks the name, returns the secret for its link.
export async function invite(name) {
  const secret = randomBytes(16).toString('base64url')
  await lock(fingerprint(secret), 'name', name)
  return secret
}

// First opening of a link: locks a new token and returns it, once, with the
// link's fingerprint and when its entry opens. Returns null for a link that
// does not exist or has been opened.
export async function open(secret) {
  const fp = fingerprint(secret)
  const kinds = entries().filter(e => e.fp === fp).map(e => e.kind)
  if (!kinds.includes('name') || kinds.includes('token')) return null
  const token = randomBytes(6).toString('base64url')
  return { token, fp, ...(await lock(fp, 'token', token)) }
}

async function resolve() {
  const now = roundAt(Date.now(), await client.chain().info())
  const people = {}
  for (const e of entries()) {
    if (e.round > now) continue
    people[e.fp] ??= {}
    people[e.fp][e.kind] = (await timelockDecrypt(e.ciphertext, client)).toString()
  }
  for (const p of Object.values(people)) console.log(`${p.name ?? '?'}\t${p.token ?? '(link never opened)'}`)
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === 'resolve') await resolve()
