// The only writer of the Bairang ledger. It keeps no log: no request, link,
// name or token is printed or stored anywhere but locked in the ledger.
//
//   GET  /i/<secret>   first opening of an invitation link: shows the token, once
//   POST /invite       body: the name; header: Authorization: Bearer <ADMIN_KEY>;
//                      returns the invitation link
//
// The ledger lives in a clone of the public repository at REPO (on a
// persistent volume); every new entry is committed there and pushed with the
// deploy key in DEPLOY_KEY. A push that fails is retried with the next entry.

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const { ADMIN_KEY, DEPLOY_KEY, REPO = '/data/repo', PORT = 80 } = process.env
const ORIGIN = 'https://github.com/koherarchitecture/bairang-ledger.git'
const PUSH = 'git@github.com:koherarchitecture/bairang-ledger.git'
const LINK = 'https://bairang.koher.app/i/'

writeFileSync('/tmp/deploy_key', Buffer.from(DEPLOY_KEY, 'base64'), { mode: 0o600 })
process.env.GIT_SSH_COMMAND = 'ssh -i /tmp/deploy_key -o StrictHostKeyChecking=accept-new'
const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { stdio: 'ignore' })
if (!existsSync(REPO)) execFileSync('git', ['clone', '-q', ORIGIN, REPO], { stdio: 'ignore' })
git('config', 'remote.origin.pushurl', PUSH)
git('config', 'user.name', 'Bairang ledger')
git('config', 'user.email', 'hello@koher.app')
try { git('pull', '-q', '--rebase') } catch {}
process.env.LEDGER = `${REPO}/ledger.jsonl`
const { invite, open } = await import('./ledger.mjs')

// One write at a time, each committed and pushed before the next.
let queue = Promise.resolve()
const write = job => {
  const run = queue.then(async () => {
    const result = await job()
    if (result) { git('add', 'ledger.jsonl'); git('commit', '-qm', 'Ledger entry') }
    try { git('push', '-q') } catch {} // an entry not yet pushed goes with the next push
    return result
  })
  queue = run.catch(() => {})
  return run
}

const page = body => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bairang</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a1428;color:#f4e8c8;font:1.3rem/1.6 Georgia,serif;padding:24px}main{max-width:32rem}code{font-size:2rem;color:#fbf3dc;letter-spacing:.08em}a{color:inherit}</style><main>${body}</main>`

createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/i/')) {
      const token = await write(() => open(req.url.slice(3).split('?')[0]))
      res.writeHead(token ? 200 : 404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
      return res.end(page(token
        ? `<p>Your token:</p><p><code>${token}</code></p><p>Write it down. It will not be shown again, and reloading this page will not show it. You pitch under it, with no name.</p><p><a href="https://bairang.koher.app">Bairang</a></p>`
        : `<p>This link has already been opened, or it does not exist.</p><p><a href="https://bairang.koher.app">Bairang</a></p>`))
    }
    if (req.method === 'POST' && req.url === '/invite' && req.headers.authorization === `Bearer ${ADMIN_KEY}`) {
      let name = ''
      for await (const chunk of req) name += chunk
      const secret = await write(() => invite(name.trim()))
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end(LINK + secret + '\n')
    }
    res.writeHead(404).end()
  } catch {
    res.writeHead(500).end()
  }
}).listen(PORT)
