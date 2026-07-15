// Turn sandbox-recorded steps into a full Deck.
//
// When the run operates on an array (the common case, and what this tool is for),
// the walkthrough is emitted as ONE Scene: the array_block + state_panel are
// declared once as persistent components, and each recorded step becomes a Step
// that PATCHES only what changed. The interactive Player renders this as a
// scoreboard (values patched in place), and normalizeDeck flattens it back to
// one slide per step for the PNG pipeline — so the screenshot path is unchanged.
//
// When there is no array at all, we fall back to the original flat-slide layout
// (a scene needs at least one persistent component to patch).
//
// Division of responsibility is unchanged: buildDeck does assembly + cosmetic
// safety (carry-forward values, stable pointer colors, callout clamping, caps);
// validateDeck stays the correctness gate (out-of-bounds indices etc.), and now
// checks the flattened scene too.

import schema from '../../src/schema/limits.json' with { type: 'json' }

const PALETTE = schema.colors
const MAX_CALLOUT = schema.maxCalloutChars
const MAX_STEP_SLIDES = schema.maxSteps
const CALLOUT_VARIANTS = schema.calloutVariants
const MAX_DESC = schema.maxDescriptionChars
const MAX_CODE = schema.maxCodeLines

const clampCallout = (text) => {
  const t = String(text)
  return t.length <= MAX_CALLOUT ? t : t.slice(0, MAX_CALLOUT - 1) + '…'
}
const clampDesc = (text) => {
  const t = String(text)
  return t.length <= MAX_DESC ? t : t.slice(0, MAX_DESC - 1) + '…'
}
const pickVariant = (v) => (CALLOUT_VARIANTS.includes(v) ? v : 'info')
const sameValues = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])

// Default component descriptions (hover/tap text). Authors can override via the
// per-step `descriptions` field in record(); first provided value wins.
const DEFAULT_DESC = {
  array: 'The array being processed. Hover a box to see its value and role at this step.',
  state: 'The variables the algorithm is tracking at this step.',
  code: 'The algorithm being traced. The highlighted line is what runs at this step.',
  tree: 'The binary tree being traversed. Hover a node to see its value and role at this step.',
  graph: 'The graph being explored. Hover a node to see its role at this step.',
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Default per-box hover text (the prototype's boxRole): value + a light,
// step-dependent role suffix from this step's pointers/highlight. Authors can
// override wholesale via step.notes. One entry per value → passes the
// notes.length <= values.length validation.
function defaultNotes(values, highlighted, pointers) {
  const hi = new Set(Array.isArray(highlighted) ? highlighted : [])
  const labelAt = new Map()
  for (const p of pointers || []) {
    labelAt.set(p.index, labelAt.has(p.index) ? `${labelAt.get(p.index)}, ${p.label}` : p.label)
  }
  return values.map((v, i) => {
    let s = `Value ${v} at index ${i}.`
    if (labelAt.has(i)) s += ` Pointer ${labelAt.get(i)} is here.`
    else if (hi.has(i)) s += ' Highlighted this step.'
    return clampDesc(s)
  })
}

// Per-node hover text for a tree run. Parallel to the level-order `nodes` array
// (null for missing slots, which the Tree component never renders). Same shape
// contract as defaultNotes so it passes notes.length <= nodes.length.
function defaultTreeNotes(nodes, highlighted, pointers) {
  const hi = new Set(Array.isArray(highlighted) ? highlighted : [])
  const labelAt = new Map()
  for (const p of pointers || [])
    labelAt.set(p.index, labelAt.has(p.index) ? `${labelAt.get(p.index)}, ${p.label}` : p.label)
  return nodes.map((v, i) => {
    if (v === null || v === undefined) return null
    let s = `Node ${v} at position ${i}.`
    if (labelAt.has(i)) s += ` Pointer ${labelAt.get(i)} is here.`
    else if (hi.has(i)) s += ' Visited this step.'
    return clampDesc(s)
  })
}

// Per-node hover text for a graph run, keyed by node id (graph notes are an
// object, not a parallel array, because a graph has no natural ordering).
function defaultGraphNotes(nodes, highlighted, pointers) {
  const hi = new Set(Array.isArray(highlighted) ? highlighted : [])
  const labelAt = new Map()
  for (const p of pointers || [])
    labelAt.set(p.node, labelAt.has(p.node) ? `${labelAt.get(p.node)}, ${p.label}` : p.label)
  const out = {}
  for (const n of nodes) {
    let s = `Node ${n.value ?? n.id}.`
    if (labelAt.has(n.id)) s += ` Pointer ${labelAt.get(n.id)} is here.`
    else if (hi.has(n.id)) s += ' Visited this step.'
    out[n.id] = clampDesc(s)
  }
  return out
}

// A run visualizes exactly ONE structure. Detection priority (array > tree >
// graph) matches record() field precedence; null means no structure → the flat
// fallback. seedValues is already resolved for the array case by the caller.
function detectStructure(usableSteps, seedValues) {
  if (Array.isArray(seedValues) && seedValues.length > 0) return 'array'
  const t = usableSteps.find((s) => Array.isArray(s.tree) && s.tree.length > 0)
  if (t) return 'tree'
  const g = usableSteps.find((s) => s.graph && Array.isArray(s.graph.nodes) && s.graph.nodes.length > 0)
  if (g) return 'graph'
  return null
}

// Build the structure-specific persistent component and a per-step patch fn.
// The scene assembly loop is shared across array/tree/graph; only the component
// shape and its patch differ, so they're isolated here. Each patchFor closes
// over carry-forward state (values/nodes/graph) so a structure prop is only
// re-patched when it actually changes — same non-repetition rule as the array
// path (and what makes a changed value pop instead of re-emitting every step).
function makeViz(kind, { seedValues, usableSteps, provided, assignColor }) {
  if (kind === 'tree') {
    const seedNodes = (usableSteps.find((s) => Array.isArray(s.tree))?.tree || []).slice()
    let currentNodes = seedNodes.slice()
    return {
      id: 'tree',
      component: {
        id: 'tree',
        type: 'tree',
        description: clampDesc(provided.tree || DEFAULT_DESC.tree),
        props: { nodes: seedNodes },
      },
      patchFor(step) {
        const p = {
          highlighted: Array.isArray(step.highlighted) ? step.highlighted : [],
          pointers: Array.isArray(step.pointers)
            ? step.pointers.map((pt) => ({ label: pt.label, index: pt.index, color: assignColor(pt.label, pt.color) }))
            : [],
        }
        if (Array.isArray(step.tree) && !sameValues(step.tree, currentNodes)) {
          p.nodes = step.tree
          currentNodes = step.tree.slice()
        }
        p.notes = Array.isArray(step.notes) ? step.notes : defaultTreeNotes(currentNodes, p.highlighted, p.pointers)
        return p
      },
    }
  }

  if (kind === 'graph') {
    const seed = usableSteps.find((s) => s.graph && Array.isArray(s.graph.nodes))?.graph || { nodes: [], edges: [] }
    const seedNodes = seed.nodes.slice()
    const seedEdges = Array.isArray(seed.edges) ? seed.edges.slice() : []
    let currentGraph = { nodes: seedNodes, edges: seedEdges }
    return {
      id: 'graph',
      component: {
        id: 'graph',
        type: 'graph',
        description: clampDesc(provided.graph || DEFAULT_DESC.graph),
        props: { nodes: seedNodes, edges: seedEdges },
      },
      patchFor(step) {
        const p = {
          highlighted: Array.isArray(step.graphHighlighted) ? step.graphHighlighted : [],
          pointers: Array.isArray(step.graphPointers)
            ? step.graphPointers.map((pt) => ({ label: pt.label, node: pt.node, color: assignColor(pt.label, pt.color) }))
            : [],
        }
        if (step.graph && Array.isArray(step.graph.nodes)) {
          const g = { nodes: step.graph.nodes, edges: Array.isArray(step.graph.edges) ? step.graph.edges : [] }
          if (!sameJson(g, currentGraph)) {
            p.nodes = g.nodes
            p.edges = g.edges
            currentGraph = g
          }
        }
        p.notes =
          step.graphNotes && typeof step.graphNotes === 'object' && !Array.isArray(step.graphNotes)
            ? step.graphNotes
            : defaultGraphNotes(currentGraph.nodes, p.highlighted, p.pointers)
        return p
      },
    }
  }

  // array (default)
  let currentValues = seedValues.slice()
  return {
    id: 'array',
    component: {
      id: 'array',
      type: 'array_block',
      description: clampDesc(provided.array || DEFAULT_DESC.array),
      props: { values: seedValues },
    },
    patchFor(step) {
      const p = {
        highlighted: Array.isArray(step.highlighted) ? step.highlighted : [],
        pointers: Array.isArray(step.pointers)
          ? step.pointers.map((pt) => ({ label: pt.label, index: pt.index, color: assignColor(pt.label, pt.color) }))
          : [],
      }
      if (Array.isArray(step.values) && !sameValues(step.values, currentValues)) {
        p.values = step.values
        currentValues = step.values.slice()
      }
      p.notes = Array.isArray(step.notes) ? step.notes : defaultNotes(currentValues, p.highlighted, p.pointers)
      if (Array.isArray(step.colors)) p.colors = step.colors
      return p
    },
  }
}

export function buildDeckFromSteps({
  title,
  subtitle,
  problemId,
  intro,
  outro,
  steps,
  initialValues,
  canvas,
  codeDisplay,
}) {
  let sid = 0
  const nextId = () => `s${++sid}`
  const meta = {
    ...(problemId ? { problem_id: String(problemId) } : {}),
    title: String(title),
    canvas: canvas || { width: 1280, height: 720 },
  }

  // ---- leading framing slides (title, optional intro) ----
  const leading = [
    {
      id: nextId(),
      template: 'title',
      components: [
        {
          type: 'title_block',
          props: {
            title: String(title).slice(0, 60),
            ...(subtitle ? { subtitle: String(subtitle).slice(0, 100) } : {}),
          },
        },
      ],
      narration: '',
    },
  ]
  if (intro) {
    leading.push({
      id: nextId(),
      template: 'concept',
      components: [{ type: 'text', props: { text: String(intro).slice(0, 240), size: 'lg' } }],
      narration: '',
    })
  }

  // ---- seed the array; reserve a step slot for the outro so we stay under the cap ----
  const reserve = outro ? 1 : 0
  const usableSteps = steps.slice(0, Math.max(0, MAX_STEP_SLIDES - reserve))

  let seedValues = Array.isArray(initialValues) ? initialValues.slice() : null
  if (!seedValues) {
    const firstWithValues = usableSteps.find((s) => Array.isArray(s.values))
    seedValues = firstWithValues ? firstWithValues.values.slice() : null
  }
  const structure = detectStructure(usableSteps, seedValues)

  // ---- no-structure fallback: original flat-slide layout ----
  if (!structure) {
    const slides = [...leading]
    for (const step of usableSteps) {
      const components = []
      if (step.state && Object.keys(step.state).length > 0)
        components.push({ type: 'state_panel', props: { vars: step.state } })
      if (step.explanation)
        components.push({
          type: 'callout',
          props: { variant: pickVariant(step.variant), text: clampCallout(step.explanation) },
        })
      if (components.length === 0)
        components.push({
          type: 'text',
          props: { text: step.explanation ? clampCallout(step.explanation) : '…', size: 'md', align: 'center' },
        })
      slides.push({ id: nextId(), template: 'array_state', components, narration: '' })
    }
    if (outro)
      slides.push({
        id: nextId(),
        template: 'concept',
        components: [{ type: 'text', props: { text: String(outro).slice(0, 240), size: 'md' } }],
        narration: '',
      })
    return { meta, slides }
  }

  // ---- scene path ----
  const colorFor = new Map()
  const assignColor = (label, requested) => {
    if (!colorFor.has(label)) {
      colorFor.set(
        label,
        requested && PALETTE.includes(requested) ? requested : PALETTE[colorFor.size % PALETTE.length],
      )
    }
    return colorFor.get(label)
  }

  const anyState = usableSteps.some((s) => s.state && Object.keys(s.state).length > 0)
  const provided = usableSteps.find((s) => s.descriptions)?.descriptions || {}

  // Optional persistent code panel. code_display is the clean source to SHOW
  // (separate from the instrumented code that was executed); record({ line })
  // highlights a 0-indexed line into it. Present → the scene switches to the
  // two-column code_walk layout (code beside the array), so the code panel and
  // a tall array/state stack don't overflow the fixed canvas.
  const codeLines = Array.isArray(codeDisplay) ? codeDisplay.map((l) => String(l)).slice(0, MAX_CODE) : null
  const showCode = !!(codeLines && codeLines.length > 0)

  const components = []
  if (showCode) {
    components.push({
      id: 'code',
      type: 'code_panel',
      description: clampDesc(provided.code || DEFAULT_DESC.code),
      props: { lines: codeLines, title: 'Algorithm' },
    })
  }
  const viz = makeViz(structure, { seedValues, usableSteps, provided, assignColor })
  components.push(viz.component)
  if (anyState) {
    components.push({
      id: 'state',
      type: 'state_panel',
      description: clampDesc(provided.state || DEFAULT_DESC.state),
      props: { vars: {} },
    })
  }

  // One Step per recorded step. The structure's patchFor (from makeViz) does the
  // cumulative carry-forward: a structure prop (values/nodes/graph) is only
  // re-patched when it actually changes, while highlighted/pointers are set every
  // step (they change and don't accumulate). `state.vars` is patched only when
  // present so gaps keep the last value instead of blanking the panel.
  const sceneSteps = usableSteps.map((step, idx) => {
    const patch = { [viz.id]: viz.patchFor(step) }
    if (anyState && step.state && Object.keys(step.state).length > 0) patch.state = { vars: step.state }
    // Highlight the active code line when in bounds (ignore stray line indices).
    if (showCode && Number.isInteger(step.line) && step.line >= 0 && step.line < codeLines.length)
      patch.code = { activeLine: step.line }

    return {
      id: `k${idx + 1}`,
      ...(step.explanation ? { caption: clampCallout(step.explanation), variant: pickVariant(step.variant) } : {}),
      patch,
    }
  })

  if (outro) {
    sceneSteps.push({ id: `k${sceneSteps.length + 1}`, caption: clampCallout(String(outro)), variant: 'info' })
  }

  // code_walk is the two-column layout (code beside array); array_state stacks
  // vertically. Pick based on whether there's a code panel to place.
  const scene = { id: 'walk', template: showCode ? 'code_walk' : 'array_state', components, steps: sceneSteps }
  return { meta, slides: leading, scenes: [scene] }
}

export const STEP_LIMITS = { maxStepSlides: MAX_STEP_SLIDES }
