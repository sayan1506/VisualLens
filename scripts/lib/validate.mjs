// Structural + bounds + prop validation for an incoming deck.
// Errors are human-readable so the host LLM can self-correct (the repair loop).
// Limits + enum lists come from src/schema/limits.json — the SAME source
// src/types/deck.ts reads, so the renderer, validator, and MCP guide can't drift.

import schema from '../../src/schema/limits.json' with { type: 'json' }
import { normalizeDeck } from '../../src/lib/normalize.mjs'

const LIMITS = schema
const TEMPLATES = schema.templates
const COLORS = schema.colors
const COMPONENT_TYPES = schema.componentTypes
const CALLOUT_VARIANTS = schema.calloutVariants

// Structural checks for scene/steps. Bounds on patched props (values length,
// highlighted/pointer indices) are NOT checked here — they're caught by the
// normal slide validation after normalizeDeck flattens each step into a slide.
function validateScenes(deck, err) {
  deck.scenes.forEach((scene, si) => {
    const at = `scene[${si}]`
    if (!scene.id) err(`${at}: missing id`)
    if (!TEMPLATES.includes(scene.template))
      err(`${at}: invalid template "${scene.template}" (allowed: ${TEMPLATES.join(', ')})`)

    const ids = new Set()
    if (!Array.isArray(scene.components) || scene.components.length === 0) {
      err(`${at}: components must be a non-empty array`)
    } else {
      scene.components.forEach((c, ci) => {
        const cat = `${at}.components[${ci}]`
        if (!c || typeof c !== 'object') return err(`${cat}: must be an object`)
        if (!c.id) err(`${cat}: scene components require an id (for value patching)`)
        else if (ids.has(c.id)) err(`${cat}: duplicate component id "${c.id}"`)
        else ids.add(c.id)
      })
    }

    if (!Array.isArray(scene.steps) || scene.steps.length === 0) {
      return err(`${at}: steps must be a non-empty array`)
    }
    if (scene.steps.length > LIMITS.maxSteps)
      err(`${at}: too many steps (${scene.steps.length} > ${LIMITS.maxSteps})`)

    scene.steps.forEach((step, ti) => {
      const sat = `${at}.steps[${ti}]`
      if (!step.id) err(`${sat}: missing id`)
      if (step.variant !== undefined && !CALLOUT_VARIANTS.includes(step.variant))
        err(`${sat}: variant must be one of ${CALLOUT_VARIANTS.join(', ')}`)
      if (typeof step.caption === 'string' && step.caption.length > LIMITS.maxCalloutChars)
        err(`${sat}: caption exceeds ${LIMITS.maxCalloutChars} chars`)
      if (step.patch !== undefined) {
        if (typeof step.patch !== 'object' || step.patch === null)
          err(`${sat}: patch must be an object of { componentId: propOverrides }`)
        else
          Object.keys(step.patch).forEach((pid) => {
            if (!ids.has(pid)) err(`${sat}: patch targets unknown component id "${pid}"`)
          })
      }
    })
  })
}

export function validateDeck(deck) {
  const errors = []
  const err = (m) => errors.push(m)

  if (!deck || typeof deck !== 'object') return { valid: false, errors: ['deck must be an object'] }

  if (!deck.meta || typeof deck.meta !== 'object') {
    err('missing meta object')
  } else {
    if (!deck.meta.title) err('meta.title is required')
    const c = deck.meta.canvas
    if (!c || typeof c.width !== 'number' || typeof c.height !== 'number')
      err('meta.canvas must have numeric width and height')
  }

  // Scene decks: validate structure first (clean scene/step-referenced errors),
  // then flatten so the per-slide checks below bounds-check every patched prop.
  let slides = deck.slides
  if (Array.isArray(deck.scenes) && deck.scenes.length > 0) {
    const before = errors.length
    validateScenes(deck, err)
    if (errors.length > before) return { valid: false, errors } // fix structure before bounds
    slides = normalizeDeck(deck).slides
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    err('deck must have a non-empty slides array or scenes array')
    return { valid: false, errors }
  }
  if (slides.length > LIMITS.maxSlides)
    err(`too many slides (${slides.length} > ${LIMITS.maxSlides})`)

  slides.forEach((slide, si) => {
    const at = `slide[${si}]`
    if (!slide.id) err(`${at}: missing id`)
    if (!TEMPLATES.includes(slide.template))
      err(`${at}: invalid template "${slide.template}" (allowed: ${TEMPLATES.join(', ')})`)
    if (!Array.isArray(slide.components) || slide.components.length === 0) {
      err(`${at}: components must be a non-empty array`)
      return
    }

    slide.components.forEach((c, ci) => {
      const cat = `${at}.components[${ci}]`
      if (!c || typeof c !== 'object') return err(`${cat}: must be an object`)
      if (!COMPONENT_TYPES.includes(c.type))
        return err(`${cat}: invalid type "${c.type}" (allowed: ${COMPONENT_TYPES.join(', ')})`)
      const p = c.props || {}

      // description (hover/tap text) is optional on ANY component instance.
      if (c.description !== undefined) {
        if (typeof c.description !== 'string') err(`${cat}: description must be a string`)
        else if (c.description.length > LIMITS.maxDescriptionChars)
          err(`${cat}: description exceeds ${LIMITS.maxDescriptionChars} chars`)
      }

      switch (c.type) {
        case 'title_block':
          if (!p.title) err(`${cat}: title_block requires props.title`)
          else if (p.title.length > LIMITS.maxTitleChars)
            err(`${cat}: title exceeds ${LIMITS.maxTitleChars} chars`)
          if (p.subtitle && p.subtitle.length > LIMITS.maxSubtitleChars)
            err(`${cat}: subtitle exceeds ${LIMITS.maxSubtitleChars} chars`)
          break
        case 'text':
          if (!p.text) err(`${cat}: text requires props.text`)
          else if (p.text.length > LIMITS.maxTextChars)
            err(`${cat}: text exceeds ${LIMITS.maxTextChars} chars`)
          break
        case 'callout':
          if (!CALLOUT_VARIANTS.includes(p.variant))
            err(`${cat}: callout variant must be one of ${CALLOUT_VARIANTS.join(', ')}`)
          if (!p.text) err(`${cat}: callout requires props.text`)
          else if (p.text.length > LIMITS.maxCalloutChars)
            err(`${cat}: callout text exceeds ${LIMITS.maxCalloutChars} chars`)
          break
        case 'array_block': {
          if (!Array.isArray(p.values) || p.values.length === 0)
            return err(`${cat}: array_block requires non-empty props.values`)
          if (p.values.length > LIMITS.maxArrayValues)
            err(`${cat}: values exceeds ${LIMITS.maxArrayValues} elements`)
          const n = p.values.length
          if (p.highlighted !== undefined) {
            if (!Array.isArray(p.highlighted)) err(`${cat}: highlighted must be an array`)
            else
              p.highlighted.forEach((h) => {
                if (typeof h !== 'number' || h < 0 || h >= n)
                  err(`${cat}: highlighted index ${h} out of bounds (0..${n - 1})`)
              })
          }
          if (p.pointers !== undefined) {
            if (!Array.isArray(p.pointers)) err(`${cat}: pointers must be an array`)
            else {
              if (p.pointers.length > LIMITS.maxPointers)
                err(`${cat}: too many pointers (max ${LIMITS.maxPointers})`)
              p.pointers.forEach((ptr) => {
                if (!ptr.label) err(`${cat}: a pointer is missing label`)
                if (typeof ptr.index !== 'number' || ptr.index < 0 || ptr.index >= n)
                  err(`${cat}: pointer "${ptr.label}" index ${ptr.index} out of bounds (0..${n - 1})`)
                if (!COLORS.includes(ptr.color))
                  err(`${cat}: pointer "${ptr.label}" color must be one of ${COLORS.join(', ')}`)
              })
            }
          }
          if (p.notes !== undefined) {
            if (!Array.isArray(p.notes)) err(`${cat}: notes must be an array parallel to values`)
            else {
              if (p.notes.length > n)
                err(`${cat}: notes has more entries (${p.notes.length}) than values (${n})`)
              p.notes.forEach((note, ni) => {
                if (note !== null && typeof note !== 'string')
                  err(`${cat}: notes[${ni}] must be a string or null`)
                else if (typeof note === 'string' && note.length > LIMITS.maxDescriptionChars)
                  err(`${cat}: notes[${ni}] exceeds ${LIMITS.maxDescriptionChars} chars`)
              })
            }
          }
          break
        }
        case 'code_panel': {
          if (!Array.isArray(p.lines) || p.lines.length === 0)
            return err(`${cat}: code_panel requires non-empty props.lines`)
          if (p.lines.length > LIMITS.maxCodeLines)
            err(`${cat}: lines exceeds ${LIMITS.maxCodeLines}`)
          if (p.activeLine !== undefined && (p.activeLine < 0 || p.activeLine >= p.lines.length))
            err(`${cat}: activeLine ${p.activeLine} out of bounds (0..${p.lines.length - 1})`)
          break
        }
        case 'state_panel':
          if (!p.vars || typeof p.vars !== 'object')
            err(`${cat}: state_panel requires props.vars object`)
          break
      }
    })
  })

  return { valid: errors.length === 0, errors }
}
