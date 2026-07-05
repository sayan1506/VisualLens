// Render a deck to PNGs from the static production bundle (dist/).
// A deck arrives at runtime (from MCP), so we inject it via window.__DECK__ and
// drive the built SPA slide-by-slide. Also writes deck.json next to the PNGs so
// `npm run play <slug>` can replay the same deck interactively.
// All logs go to stderr — stdout is reserved for the MCP protocol.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { serveStaticFile } from './static.mjs'
import { normalizeDeck } from '../../src/lib/normalize.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..') // scripts/lib -> repo root
const distDir = resolve(root, 'dist')

function startStaticServer() {
  const server = createServer((req, res) => serveStaticFile(distDir, req, res))
  return new Promise((res) => {
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }))
  })
}

export async function renderDeckToPngs(deck, outDir) {
  if (!existsSync(distDir)) throw new Error('dist/ not found — run `npm run build` first')

  const { width, height } = deck.meta.canvas
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  await writeFile(resolve(outDir, 'deck.json'), JSON.stringify(deck, null, 2))

  const { server, port } = await startStaticServer()
  const base = `http://127.0.0.1:${port}`
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: width + 120, height: height + 120 } })
    await page.addInitScript((d) => {
      window.__DECK__ = d
    }, deck)

    // Scene decks expose their frames only after normalization; deck.slides
    // alone would be just the leading title/intro. App's ?slide=N path
    // normalizes the same way, so the count and the rendered frame agree.
    const frameCount = (normalizeDeck(deck).slides ?? []).length
    const paths = []
    for (let i = 0; i < frameCount; i++) {
      await page.goto(`${base}/?slide=${i}`, { waitUntil: 'load' })
      const el = await page.waitForSelector('[data-slide-frame]')
      const num = String(i + 1).padStart(2, '0')
      const outPath = resolve(outDir, `slide-${num}.png`)
      await el.screenshot({ path: outPath })
      paths.push(outPath)
      console.error(`  rendered slide ${num}/${frameCount}`)
    }
    return paths
  } finally {
    await browser.close()
    server.close()
  }
}
