// Interactive player CLI: resolve a deck, serve it, open the browser.
// Deck arg can be an example name (two-sum-ii), a rendered slug
// (out/<slug>/deck.json), or a path to a deck.json. Defaults to two-sum-ii.
// Usage: node scripts/play.mjs [deck]
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, isAbsolute } from 'node:path'
import { spawn } from 'node:child_process'
import { startPlayServer } from './lib/playServer.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

function resolveDeck(arg) {
  const name = arg || 'two-sum-ii'
  const candidates = []
  if (name.endsWith('.json')) candidates.push(isAbsolute(name) ? name : resolve(process.cwd(), name))
  candidates.push(resolve(root, 'src', 'examples', `${name}.json`))
  candidates.push(resolve(root, 'out', name, 'deck.json'))
  for (const p of candidates) if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'))
  return null
}

function openBrowser(url) {
  const platform = process.platform
  const [cmd, args] =
    platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
  } catch {
    /* headless / no browser — the URL is printed anyway */
  }
}

const deck = resolveDeck(process.argv[2])
if (!deck) {
  console.error(`could not resolve deck "${process.argv[2] ?? ''}".`)
  console.error(
    'try: an example name (two-sum-ii, binary-search), a rendered slug (out/<slug>/deck.json), or a path to a deck.json',
  )
  process.exit(1)
}
if (!deck.meta?.canvas) {
  deck.meta = deck.meta || {}
  deck.meta.canvas = { width: 1280, height: 720 }
}

let started
try {
  started = await startPlayServer(deck)
} catch (e) {
  console.error(`${e.message}`)
  process.exit(1)
}
console.error(`\n▶ VisualLens player: ${started.url}`)
console.error(`  ${deck.slides.length} slides · "${deck.meta.title}"`)
console.error('  Arrow keys / Space to navigate, or click. Ctrl+C to stop.\n')
openBrowser(started.url)

process.on('SIGINT', () => {
  started.server.close()
  process.exit(0)
})
