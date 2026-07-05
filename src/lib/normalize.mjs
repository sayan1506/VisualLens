// Scene -> Slide[] normalization, shared by the Node scripts (render, validate)
// and the Vite app. Plain .mjs so both worlds import ONE implementation; the
// types live alongside in normalize.d.mts. See PLAN.md Part 2.
//
// Canonical deck form (what is authored / built / stored):
//   { meta, slides?: <leading framing slides only>, scenes? }
// normalizeDeck expands each scene into one slide per step and appends them
// AFTER the leading slides. NEVER persist the result — always normalize from
// canonical input, which keeps normalizeDeck trivially idempotent (a canonical
// scene deck never already contains its own flattened step-slides).

// Resolve a scene's components for one step: shallow-merge the step's per-id
// prop overrides onto each component's base props. A patched prop (values,
// highlighted, ...) replaces the base wholesale.
export function applyPatch(components, patch) {
  return components.map((c) => {
    const over = patch && c.id ? patch[c.id] : undefined
    return over ? { ...c, props: { ...c.props, ...over } } : { ...c, props: { ...c.props } }
  })
}

// One Slide per step. CUMULATIVE: each step's patch applies on top of the
// PREVIOUS step's resolved state, not the base — the scoreboard model. A value
// set at step 3 persists through step 4+ until another step overrides it, so
// authors patch ONLY what changes (non-repetition) while every frame stays
// fully specified. To clear something (e.g. a highlight), patch it explicitly
// (highlighted: []), since omitting a prop now means "unchanged", not "reset".
//
// Each exposed frame is deep-cloned (structuredClone): the running accumulator
// carries shallow references forward (a values array persisted across steps is
// one object), so without the clone sibling frames would alias the same array
// and the source deck's own arrays. Deck props are JSON data by contract, so
// structuredClone is total here. The caption renders as a trailing callout so
// static PNGs still show the per-step explanation (hover text is interactive-only).
export function flattenScene(scene) {
  let acc = scene.components.map((c) => ({ ...c, props: { ...c.props } }))
  return scene.steps.map((step, i) => {
    acc = applyPatch(acc, step.patch)
    const snapshot = structuredClone(acc)
    const components = step.caption
      ? [...snapshot, { type: 'callout', props: { variant: step.variant || 'info', text: step.caption } }]
      : snapshot
    return {
      id: `${scene.id}-${step.id || i + 1}`,
      template: scene.template,
      components,
      narration: step.narration || '',
    }
  })
}

// Expand scenes into deck.slides (leading framing slides first, then one slide
// per scene step). Pure — returns a new deck. The result DROPS `scenes`, which
// makes normalizeDeck idempotent: a second call sees no scenes and returns the
// deck unchanged. Safe to call at every display entry point.
//
// The scoreboard (patch-in-place) does NOT depend on scenes surviving:
// flattenScene copies each component's `id` onto the step slides, so stepping
// between those slides reconciles by id and patches the DOM in place. Scenes
// are purely an authoring convenience; nothing downstream needs them.
export function normalizeDeck(deck) {
  if (!deck || !Array.isArray(deck.scenes) || deck.scenes.length === 0) return deck
  const leading = Array.isArray(deck.slides) ? deck.slides : []
  const sceneSlides = deck.scenes.flatMap(flattenScene)
  const { scenes, ...rest } = deck
  void scenes
  return { ...rest, slides: [...leading, ...sceneSlides] }
}
