// Direct test of the sandbox runner + step mapper (no MCP, no browser).
// Verifies: correct steps from real execution, and that each failure mode
// returns a friendly result instead of crashing.
import { runInstrumentedCode } from './lib/runner.mjs'
import { buildDeckFromSteps } from './lib/buildDeck.mjs'
import { validateDeck } from './lib/validate.mjs'

let failures = 0
const check = (name, cond, detail = '') => {
  console.error(`${cond ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) failures++
}

// 1. Happy path: binary search must produce the correct trace.
const bsCode = `
  const { nums, target } = input;
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    record({ values: nums, highlighted: [mid],
      pointers: [{label:'lo',index:lo},{label:'mid',index:mid},{label:'hi',index:hi}],
      state: { lo, hi, mid, 'nums[mid]': nums[mid], target },
      explanation: 'step', variant: nums[mid]===target?'success':'info' });
    if (nums[mid] === target) break;
    else if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
`
const bs = await runInstrumentedCode(bsCode, { nums: [1, 3, 5, 7, 9, 11], target: 7 }, { timeoutMs: 2000, maxSteps: 40 })
check('binary search ok', bs.ok, bs.error || '')
check('binary search step count = 3', bs.steps.length === 3, `got ${bs.steps.length}`)
const mids = bs.steps.map((s) => s.state.mid)
check('mids are 2,4,3', JSON.stringify(mids) === JSON.stringify([2, 4, 3]), JSON.stringify(mids))
const midVals = bs.steps.map((s) => s.state['nums[mid]'])
check('nums[mid] are 5,9,7', JSON.stringify(midVals) === JSON.stringify([5, 9, 7]), JSON.stringify(midVals))
check('last step is success', bs.steps[2].variant === 'success')

// Assemble + validate the deck built from those steps.
const deck = buildDeckFromSteps({ title: 'Binary Search', intro: 'Halve each step.', outro: 'O(log n).', steps: bs.steps, initialValues: bs.steps[0].values })
const v = validateDeck(deck)
check('assembled deck is valid', v.valid, v.errors.join('; '))
check('deck slide count = 3 steps + title + intro + outro = 6', deck.slides.length === 6, `got ${deck.slides.length}`)

// 2. Failure: code throws.
const thrown = await runInstrumentedCode(`throw new Error('boom')`, {}, {})
check('thrown error is caught', thrown.ok === false && /boom/.test(thrown.error), thrown.error)

// 3. Failure: infinite loop must be killed by the vm timeout / backstop.
const loop = await runInstrumentedCode(`while(true){}`, {}, { timeoutMs: 800 })
check('infinite loop is stopped', loop.ok === false, loop.error)

// 4. Failure: no record() calls.
const silent = await runInstrumentedCode(`const x = 1 + 1;`, {}, {})
check('silent code -> ok with 0 steps', silent.ok === true && silent.steps.length === 0)

// 5. Out-of-bounds pointer from buggy code should be caught by validateDeck.
const badPtr = await runInstrumentedCode(
  `record({ values:[1,2,3], pointers:[{label:'p',index:9}], explanation:'oops' })`,
  {},
  {},
)
const badDeck = buildDeckFromSteps({ title: 'Bad', steps: badPtr.steps, initialValues: [1, 2, 3] })
const bv = validateDeck(badDeck)
check('out-of-bounds pointer rejected by validator', bv.valid === false && bv.errors.some((e) => /out of bounds/.test(e)))

console.error(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`)
process.exit(failures === 0 ? 0 : 1)
