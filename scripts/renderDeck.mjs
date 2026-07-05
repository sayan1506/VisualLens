// Phase 2 core: render every slide of a named deck to a PNG folder.
// Usage: node scripts/renderDeck.mjs <deck-name>   (e.g. two-sum-ii)
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync, rmSync, readFileSync } from 'node:fs'
import { normalizeDeck } from '../src/lib/normalize.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const deckName = process.argv[2]
if (!deckName) {
  console.error('usage: node scripts/renderDeck.mjs <deck-name>')
  process.exit(1)
}

const deckPath = resolve(root, 'src', 'examples', `${deckName}.json`)
let deck
try {
  deck = JSON.parse(readFileSync(deckPath, 'utf8'))
} catch {
  console.error(`deck not found: ${deckPath}`)
  process.exit(1)
}
// Scene decks expose their frames only after normalization; App's ?slide=N path
// normalizes the same way, so this count matches the frame each URL renders.
const slideCount = (normalizeDeck(deck).slides ?? []).length
const { width, height } = deck.meta.canvas

const server = await createServer({ root, server: { port: 5199 } })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')

const outDir = resolve(root, 'out', deckName)
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: width + 120, height: height + 120 } })

for (let i = 0; i < slideCount; i++) {
  await page.goto(`${base}/?deck=${deckName}&slide=${i}`, { waitUntil: 'load' })
  const el = await page.waitForSelector('[data-slide-frame]')
  const num = String(i + 1).padStart(2, '0')
  const outPath = resolve(outDir, `slide-${num}.png`)
  await el.screenshot({ path: outPath })
  console.log(`  slide ${num}/${String(slideCount).padStart(2, '0')} → ${outPath}`)
}

console.log(`\ndone: ${slideCount} slides → out/${deckName}/`)
await browser.close()
await server.close()
process.exit(0)
