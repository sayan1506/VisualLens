// Automated test of the interactive player: start the play server, load the
// Player in a real browser (deck arrives via /__deck.json fetch — the true play
// flow), verify controls render and Next advances the counter, screenshot it.
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { startPlayServer } from './lib/playServer.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

let failures = 0
const check = (name, cond, detail = '') => {
  console.error(`${cond ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) failures++
}

const deck = JSON.parse(readFileSync(resolve(root, 'src', 'examples', 'binary-search.json'), 'utf8'))
if (!deck.meta.canvas) deck.meta.canvas = { width: 1280, height: 720 }

let started
try {
  started = await startPlayServer(deck)
} catch (e) {
  console.error(`cannot start play server: ${e.message} (run \`npm run build\` first)`)
  process.exit(1)
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(started.url, { waitUntil: 'load' })

  await page.waitForSelector('[data-player]')
  await page.waitForSelector('[data-controls]')
  check('player + controls render', true)
  check('slide frame present (reused component)', !!(await page.$('[data-slide-frame]')))

  const c1 = (await page.textContent('[data-counter]'))?.trim()
  check('counter starts at 1 / N', c1 === `1 / ${deck.slides.length}`, c1)

  await page.click('[data-next]')
  const c2 = (await page.textContent('[data-counter]'))?.trim()
  check('Next advances to 2 / N', c2 === `2 / ${deck.slides.length}`, c2)

  await page.click('[data-prev]')
  const c3 = (await page.textContent('[data-counter]'))?.trim()
  check('Prev returns to 1 / N', c3 === `1 / ${deck.slides.length}`, c3)

  mkdirSync(resolve(root, 'out'), { recursive: true })
  await page.click('[data-next]') // show a data-rich slide in the screenshot
  await page.screenshot({ path: resolve(root, 'out', 'player.png') })
  console.error('player screenshot: out/player.png')
} finally {
  await browser.close()
  started.server.close()
}

console.error(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`)
process.exit(failures === 0 ? 0 : 1)
