// The only writer of the Bairang ledger. It keeps no log: no request, link,
// name or token is printed or stored anywhere but locked in the ledger.
//
//   GET  /i/<secret>   first opening of an invitation link: shows the token, once,
//                      and downloads it as a JSON file with the name and the question
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
const QUESTION = 'When something I make does not reach somebody, either I failed to send it or they failed to receive it. I can rarely tell which. Make one work about something that did not arrive, and leave the question of whose failure it was open inside the work.'
const PITCH = 'Half a page, sent under your token with no name: what you will make, what it is made of, how big it is or how long it runs, and what it needs from the space (a wall, a table, a screen, sound, power).'

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
      const opened = await write(() => open(req.url.slice(3).split('?')[0]))
      res.writeHead(opened ? 200 : 404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
      if (!opened) return res.end(page(`<p>This link has already been opened, or it does not exist.</p><p><a href="https://bairang.koher.app">Bairang</a></p>`))
      // The file is put together in the browser. The name comes from the part of
      // the link after #, which the browser never sends, so the server never sees it.
      const file = {
        type: 'bairang_invitation', episode: 1, token: opened.token, question: QUESTION, pitch: PITCH,
        ledger: 'https://github.com/koherarchitecture/bairang-ledger',
        ledger_fingerprint: opened.fp, ledger_round: opened.round, ledger_opens: opened.opensAt,
        site: 'https://bairang.koher.app',
      }
      return res.end(page(`<p>Your token:</p><p><code>${opened.token}</code></p><p>A file with your token, your name and the question should have downloaded. If it did not, use the link below. Keep it. Once you leave or reload this page, neither the file nor the token can be shown again. You pitch under the token, with no name.</p><p><a id="again" href="#">Download the file again</a> · <a href="https://bairang.koher.app">Bairang</a></p>
<script>
const file = ${JSON.stringify(file).replace(/</g, '\\u003c')}
const name = new URLSearchParams(location.hash.slice(1)).get('name')
history.replaceState(null, '', location.pathname)
const data = name ? { type: file.type, episode: file.episode, name, ...file } : file
const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\\n'], { type: 'application/json' }))
const save = () => Object.assign(document.createElement('a'), { href: url, download: 'bairang-' + file.token + '.json' }).click()
document.getElementById('again').onclick = e => { e.preventDefault(); save() }
save()
</script>`))
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
