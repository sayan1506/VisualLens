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
}

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

export function buildDeckFromSteps({
  title,
  subtitle,
  problemId,
  intro,
  outro,
  steps,
  initialValues,
  canvas,
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
  const hasArray = Array.isArray(seedValues) && seedValues.length > 0

  // ---- no-array fallback: original flat-slide layout ----
  if (!hasArray) {
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

  const components = [
    {
      id: 'array',
      type: 'array_block',
      description: clampDesc(provided.array || DEFAULT_DESC.array),
      props: { values: seedValues },
    },
  ]
  if (anyState) {
    components.push({
      id: 'state',
      type: 'state_panel',
      description: clampDesc(provided.state || DEFAULT_DESC.state),
      props: { vars: {} },
    })
  }

  // One Step per recorded step. Cumulative patching means we only re-patch
  // `values` when they actually change (so a run that passes the same array
  // every step doesn't repeat it); `highlighted`/`pointers` are set every step
  // because they change and don't accumulate; `state.vars` is patched only when
  // present so gaps keep the last value instead of blanking the panel.
  let currentValues = seedValues.slice()
  const sceneSteps = usableSteps.map((step, idx) => {
    const arrayPatch = {
      highlighted: Array.isArray(step.highlighted) ? step.highlighted : [],
      pointers: Array.isArray(step.pointers)
        ? step.pointers.map((p) => ({ label: p.label, index: p.index, color: assignColor(p.label, p.color) }))
        : [],
    }
    if (Array.isArray(step.values) && !sameValues(step.values, currentValues)) {
      arrayPatch.values = step.values
      currentValues = step.values.slice()
    }
    // Per-box hover text: author override wins, else auto-generate value + role
    // (recomputed each step so the role suffix follows the pointer/highlight).
    arrayPatch.notes = Array.isArray(step.notes)
      ? step.notes
      : defaultNotes(currentValues, arrayPatch.highlighted, arrayPatch.pointers)

    const patch = { array: arrayPatch }
    if (anyState && step.state && Object.keys(step.state).length > 0) patch.state = { vars: step.state }

    return {
      id: `k${idx + 1}`,
      ...(step.explanation ? { caption: clampCallout(step.explanation), variant: pickVariant(step.variant) } : {}),
      patch,
    }
  })

  if (outro) {
    sceneSteps.push({ id: `k${sceneSteps.length + 1}`, caption: clampCallout(String(outro)), variant: 'info' })
  }

  const scene = { id: 'walk', template: 'array_state', components, steps: sceneSteps }
  return { meta, slides: leading, scenes: [scene] }
}

export const STEP_LIMITS = { maxStepSlides: MAX_STEP_SLIDES }
