import type { Deck, Slide } from './types/deck'

// Example decks bundled at build time (dev fallback + interactive demos).
const deckModules = import.meta.glob('./examples/*.json', { eager: true }) as Record<
  string,
  { default: Deck }
>

export const exampleDecks: Record<string, Deck> = {}
for (const [path, mod] of Object.entries(deckModules)) {
  const name = path.split('/').pop()!.replace('.json', '')
  exampleDecks[name] = mod.default ?? (mod as unknown as Deck)
}

export const demoSlide: Slide = {
  id: 's-demo',
  template: 'array_state',
  components: [
    {
      type: 'title_block',
      props: { title: 'VisualLens', subtitle: 'Pass ?deck=two-sum-ii or run npm run play' },
    },
    {
      type: 'array_block',
      props: {
        values: [2, 7, 11, 15],
        highlighted: [0, 3],
        pointers: [
          { label: 'L', index: 0, color: 'orange' },
          { label: 'R', index: 3, color: 'blue' },
        ],
      },
    },
  ],
}

export const demoDeck: Deck = {
  meta: { problem_id: 'demo', title: 'VisualLens', canvas: { width: 1280, height: 720 } },
  slides: [demoSlide],
}

// A deck is renderable if it has step slides OR scenes (which normalize into
// slides). Guards must accept both, or scene decks silently fall back to demo.
export function hasFrames(d?: Deck | null): d is Deck {
  return (
    !!d &&
    ((Array.isArray(d.slides) && d.slides.length > 0) ||
      (Array.isArray(d.scenes) && d.scenes.length > 0))
  )
}

// Deck for the current URL, resolved synchronously (window injection or ?deck=).
// Returns null when the deck must be fetched from the play server (/__deck.json).
// The raw (canonical) deck is returned; display components call normalizeDeck.
export function resolveDeckSync(): Deck | null {
  if (hasFrames(window.__DECK__)) return window.__DECK__
  const name = new URLSearchParams(window.location.search).get('deck')
  if (name && exampleDecks[name]) return exampleDecks[name]
  return null
}
