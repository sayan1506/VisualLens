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

// Deck for the current URL, resolved synchronously (window injection or ?deck=).
// Returns null when the deck must be fetched from the play server (/__deck.json).
export function resolveDeckSync(): Deck | null {
  if (window.__DECK__ && Array.isArray(window.__DECK__.slides) && window.__DECK__.slides.length) {
    return window.__DECK__
  }
  const name = new URLSearchParams(window.location.search).get('deck')
  if (name && exampleDecks[name]) return exampleDecks[name]
  return null
}
