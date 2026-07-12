// Direct test of the sandbox runner + step mapper (no MCP, no browser).
// Verifies: correct steps from real execution, and that each failure mode
// returns a friendly result instead of crashing.
import { runInstrumentedCode } from './lib/runner.mjs'
import { buildDeckFromSteps } from './lib/buildDeck.mjs'
import { validateDeck } from './lib/validate.mjs'
import { normalizeDeck } from '../src/lib/normalize.mjs'

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
// An array run is now emitted as a scene: 2 leading slides (title + intro) + a
// scene whose components persist across steps.
check('deck emits a scene', Array.isArray(deck.scenes) && deck.scenes.length === 1, `scenes=${deck.scenes?.length}`)
check('leading slides = title + intro', deck.slides.length === 2, `got ${deck.slides.length}`)
check('scene has persistent array component with an id', deck.scenes[0].components.some((c) => c.id === 'array'))
// Flattened, it is still 3 steps + title + intro + outro = 6 frames for the PNG pipeline.
const flat = normalizeDeck(deck).slides
check('flattens to 6 frames', flat.length === 6, `got ${flat.length}`)
check('every scene box has default hover notes', deck.scenes[0].steps[0].patch.array.notes.length === bs.steps[0].values.length)

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

// 6. Tree run: a level-order tree trace should emit a scene with a tree component.
const treeCode = `
  const { nodes } = input;
  const seen = [];
  function visit(i) {
    if (i >= nodes.length || nodes[i] === null) return;
    seen.push(i);
    record({ tree: nodes, highlighted: seen.slice(),
      pointers: [{ label: 'cur', index: i }],
      state: { node: nodes[i] }, explanation: 'visit ' + nodes[i] });
    visit(2 * i + 1); visit(2 * i + 2);
  }
  visit(0);
`
const tree = await runInstrumentedCode(treeCode, { nodes: [3, 9, 20, null, null, 15, 7] }, { timeoutMs: 2000, maxSteps: 40 })
check('tree run ok', tree.ok, tree.error || '')
check('tree visits 5 real nodes', tree.steps.length === 5, `got ${tree.steps.length}`)
check('tree field preserved through sandbox', Array.isArray(tree.steps[0].tree) && tree.steps[0].tree.length === 7)
const treeDeck = buildDeckFromSteps({ title: 'Max Depth', steps: tree.steps })
const tv = validateDeck(treeDeck)
check('tree deck is valid', tv.valid, tv.errors.join('; '))
check(
  'tree deck emits a tree scene',
  treeDeck.scenes?.[0]?.components.some((c) => c.type === 'tree' && c.id === 'tree'),
)
check('tree scene has default per-node notes', treeDeck.scenes?.[0]?.steps[0].patch.tree.notes.length === 7)

// 7. Graph run: a graph trace should emit a scene with a graph component.
const graphCode = `
  const nodes = [
    { id: 'A', x: 0.5, y: 0.1 },
    { id: 'B', x: 0.2, y: 0.5 },
    { id: 'C', x: 0.8, y: 0.5 }
  ];
  const edges = [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }];
  const visited = [];
  for (const id of ['A', 'B', 'C']) {
    visited.push(id);
    record({ graph: { nodes, edges }, graphHighlighted: visited.slice(),
      graphPointers: [{ label: 'cur', node: id }],
      state: { visiting: id }, explanation: 'visit ' + id });
  }
`
const graph = await runInstrumentedCode(graphCode, {}, { timeoutMs: 2000, maxSteps: 40 })
check('graph run ok', graph.ok, graph.error || '')
check('graph records 3 steps', graph.steps.length === 3, `got ${graph.steps.length}`)
check('graph field preserved through sandbox', graph.steps[0].graph && graph.steps[0].graph.nodes.length === 3)
check('graphHighlighted preserved', Array.isArray(graph.steps[0].graphHighlighted))
const graphDeck = buildDeckFromSteps({ title: 'BFS', steps: graph.steps })
const gv = validateDeck(graphDeck)
check('graph deck is valid', gv.valid, gv.errors.join('; '))
check(
  'graph deck emits a graph scene',
  graphDeck.scenes?.[0]?.components.some((c) => c.type === 'graph' && c.id === 'graph'),
)
check(
  'graph scene carries pointers keyed by node id',
  graphDeck.scenes?.[0]?.steps[0].patch.graph.pointers[0].node === 'A',
)

// 8. Validator: a tree highlight pointing at a null (missing) slot is rejected.
const badTree = validateDeck({
  meta: { title: 'Bad tree', canvas: { width: 1280, height: 720 } },
  slides: [
    { id: 's1', template: 'array_state', components: [{ type: 'tree', props: { nodes: [1, null, 3], highlighted: [1] } }] },
  ],
})
check(
  'tree null-slot highlight rejected',
  badTree.valid === false && badTree.errors.some((e) => /null/.test(e)),
  badTree.errors.join('; '),
)

// 9. Validator: a graph edge referencing an unknown node id is rejected.
const badGraph = validateDeck({
  meta: { title: 'Bad graph', canvas: { width: 1280, height: 720 } },
  slides: [
    {
      id: 's1',
      template: 'array_state',
      components: [
        { type: 'graph', props: { nodes: [{ id: 'A', x: 0.5, y: 0.5 }], edges: [{ from: 'A', to: 'Z' }] } },
      ],
    },
  ],
})
check(
  'graph unknown edge target rejected',
  badGraph.valid === false && badGraph.errors.some((e) => /not a known node id/.test(e)),
  badGraph.errors.join('; '),
)

console.error(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`)
process.exit(failures === 0 ? 0 : 1)
