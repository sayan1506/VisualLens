// Render a deck JSON file through the static bundle (the same path the MCP
// server uses). Useful for verifying the production pipeline without Claude
// Desktop, and as a standalone CLI.
// Usage: node scripts/renderFromFile.mjs <path-to-deck.json> [outName]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'
import { renderDeckToPngs } from './lib/render.mjs'
import { validateDeck } from './lib/validate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const deckPath = process.argv[2]
if (!deckPath) {
  console.error('usage: node scripts/renderFromFile.mjs <path-to-deck.json> [outName]')
  process.exit(1)
}

const deck = JSON.parse(readFileSync(deckPath, 'utf8'))
if (!deck.meta?.canvas) {
  deck.meta = deck.meta || {}
  deck.meta.canvas = { width: 1280, height: 720 }
}

const { valid, errors } = validateDeck(deck)
if (!valid) {
  console.error('validation failed:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}

const outName = process.argv[3] || basename(deckPath).replace(/\.json$/, '')
const outDir = resolve(root, 'out', outName)
const paths = await renderDeckToPngs(deck, outDir)
console.error(`\ndone: ${paths.length} slides → out/${outName}/`)
process.exit(0)
