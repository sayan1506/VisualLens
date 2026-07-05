import { createContext, useContext } from 'react'

// Lets any component report a hover/tap/focus "what is this" description up to
// the Player's info panel, without prop-drilling. In PNG/single-slide mode there
// is no provider, so the setter is a no-op and hover does nothing (descriptions
// are interactive-only — they never appear in screenshots).

export interface HoverInfo {
  title: string
  body: string
}

type HoverSetter = (info: HoverInfo | null) => void

const HoverContext = createContext<HoverSetter>(() => {})

export const HoverProvider = HoverContext.Provider

export function useHoverSetter(): HoverSetter {
  return useContext(HoverContext)
}

// Build handler props for one hover target. Plain function (not a hook) so it
// can run inside a .map() — e.g. ArrayBlock's per-box notes. Spread onto the
// target's ROOT element (no wrapper div, so template layout is unaffected).
// Returns empty when there's nothing to describe, leaving the element inert +
// unfocusable — so legacy decks with no descriptions behave exactly as before.
export function hoverHandlers(set: HoverSetter, info: HoverInfo | null) {
  if (!info || !info.body) return {}
  return {
    tabIndex: 0,
    onMouseEnter: () => set(info),
    onMouseLeave: () => set(null),
    onFocus: () => set(info),
    onBlur: () => set(null),
    onClick: () => set(info), // tap (mobile)
  }
}

// Convenience for single-target components (one hover region per component).
export function useHover(info: HoverInfo | null) {
  return hoverHandlers(useHoverSetter(), info)
}
