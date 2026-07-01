// Phase 0 smoke test: start Vite programmatically, screenshot the page with Playwright.
// Self-contained — no separate `npm run dev` needed.
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const server = await createServer({ root, server: { port: 5199 } })
await server.listen()
const url = server.resolvedUrls.local[0]
console.log('dev server:', url)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('h1')

mkdirSync(resolve(root, 'out'), { recursive: true })
const outPath = resolve(root, 'out', 'test.png')
await page.screenshot({ path: outPath })
console.log('screenshot saved:', outPath)

await browser.close()
await server.close()
process.exit(0)
