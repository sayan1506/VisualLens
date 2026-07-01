// Serves the built SPA plus a /__deck.json route carrying the deck to play.
// Used by the play CLI (interactive) and the automated play-test.
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { serveStaticFile } from './static.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')
const distDir = resolve(root, 'dist')

export function startPlayServer(deck, port = 0) {
  if (!existsSync(distDir)) throw new Error('dist/ not found — run `npm run build` first')
  const payload = JSON.stringify(deck)
  const server = createServer(async (req, res) => {
    if (req.url.split('?')[0] === '/__deck.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(payload)
    }
    await serveStaticFile(distDir, req, res)
  })
  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port
      resolvePromise({ server, port: p, url: `http://127.0.0.1:${p}` })
    })
  })
}
