// Structural + bounds + prop validation for an incoming deck.
// Errors are human-readable so the host LLM can self-correct (the repair loop).
// Kept in sync with src/types/deck.ts LIMITS — update both together.

const LIMITS = {
  maxSlides: 40,
  maxTitleChars: 60,
  maxSubtitleChars: 100,
  maxTextChars: 240,
  maxCalloutChars: 160,
  maxArrayValues: 12,
  maxCodeLines: 14,
  maxPointers: 4,
}

const TEMPLATES = ['title', 'concept', 'array_state', 'code_walk']
const COLORS = ['orange', 'blue', 'green', 'red']
const COMPONENT_TYPES = ['title_block', 'text', 'callout', 'array_block', 'code_panel', 'state_panel']
const CALLOUT_VARIANTS = ['info', 'warn', 'success']

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

  if (!Array.isArray(deck.slides) || deck.slides.length === 0) {
    err('slides must be a non-empty array')
    return { valid: false, errors }
  }
  if (deck.slides.length > LIMITS.maxSlides)
    err(`too many slides (${deck.slides.length} > ${LIMITS.maxSlides})`)

  deck.slides.forEach((slide, si) => {
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
