// Dev preview: screenshot a single rich slide at native canvas size using
// single-slide mode (?slide=), independent of the interactive player.
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const server = await createServer({ root, server: { port: 5199 } })
await server.listen()
const url = server.resolvedUrls.local[0].replace(/\/$/, '')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
// Single-slide mode with an example deck → deterministic, no player chrome.
await page.goto(`${url}/?deck=two-sum-ii&slide=2`, { waitUntil: 'load' })
const el = await page.waitForSelector('[data-slide-frame]')

mkdirSync(resolve(root, 'out'), { recursive: true })
const outPath = resolve(root, 'out', 'preview.png')
await el.screenshot({ path: outPath })
console.log('slide preview saved:', outPath)

await browser.close()
await server.close()
process.exit(0)
