// Turn sandbox-recorded steps into a full Deck (same shape as a hand-authored
// one, so it flows through validateDeck + renderDeckToPngs unchanged).
//
// Division of responsibility:
//  - buildDeck does assembly + COSMETIC safety it can guarantee (carry-forward
//    array values, stable per-label pointer colors, callout length clamping,
//    slide cap).
//  - validateDeck stays the correctness gate: out-of-bounds indices from buggy
//    code, oversized arrays, etc. still surface as repair messages to the host.

const PALETTE = ['orange', 'blue', 'green', 'red']
const MAX_CALLOUT = 160
const MAX_STEP_SLIDES = 34 // leaves room for title/intro/outro under the 40-slide cap
const CALLOUT_VARIANTS = ['info', 'warn', 'success']

function clampCallout(text) {
  const t = String(text)
  return t.length <= MAX_CALLOUT ? t : t.slice(0, MAX_CALLOUT - 1) + '…'
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
  const slides = []
  let sid = 0
  const nextId = () => `s${++sid}`

  // 1. Title
  slides.push({
    id: nextId(),
    template: 'title',
    components: [
      { type: 'title_block', props: { title: String(title).slice(0, 60), ...(subtitle ? { subtitle: String(subtitle).slice(0, 100) } : {}) } },
    ],
    narration: '',
  })

  // 2. Intro (optional)
  if (intro) {
    slides.push({
      id: nextId(),
      template: 'concept',
      components: [{ type: 'text', props: { text: String(intro).slice(0, 240), size: 'lg' } }],
      narration: '',
    })
  }

  // 3. One array_state slide per recorded step
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

  let currentValues = Array.isArray(initialValues) ? initialValues.slice() : null
  const usableSteps = steps.slice(0, MAX_STEP_SLIDES)

  for (const step of usableSteps) {
    if (Array.isArray(step.values)) currentValues = step.values.slice()
    const components = []

    if (currentValues && currentValues.length > 0) {
      const pointers = Array.isArray(step.pointers)
        ? step.pointers.map((p) => ({ label: p.label, index: p.index, color: assignColor(p.label, p.color) }))
        : []
      components.push({
        type: 'array_block',
        props: {
          values: currentValues,
          ...(Array.isArray(step.highlighted) && step.highlighted.length ? { highlighted: step.highlighted } : {}),
          ...(pointers.length ? { pointers } : {}),
        },
      })
    }

    if (step.state && Object.keys(step.state).length > 0) {
      components.push({ type: 'state_panel', props: { vars: step.state } })
    }

    if (step.explanation) {
      const variant = CALLOUT_VARIANTS.includes(step.variant) ? step.variant : 'info'
      components.push({ type: 'callout', props: { variant, text: clampCallout(step.explanation) } })
    }

    // A step with nothing renderable still needs a component; fall back to text.
    if (components.length === 0) {
      components.push({ type: 'text', props: { text: step.explanation ? clampCallout(step.explanation) : '…', size: 'md', align: 'center' } })
    }

    slides.push({ id: nextId(), template: 'array_state', components, narration: '' })
  }

  // 4. Outro (optional)
  if (outro) {
    slides.push({
      id: nextId(),
      template: 'concept',
      components: [
        { type: 'text', props: { text: String(outro).slice(0, 240), size: 'md' } },
      ],
      narration: '',
    })
  }

  return {
    meta: {
      ...(problemId ? { problem_id: String(problemId) } : {}),
      title: String(title),
      canvas: canvas || { width: 1280, height: 720 },
    },
    slides,
  }
}

export const STEP_LIMITS = { maxStepSlides: MAX_STEP_SLIDES }
