import { useEffect, useState, type CSSProperties } from 'react'
import SlideRenderer from './slides/SlideRenderer'
import Player from './Player'
import type { Deck } from './types/deck'
import { resolveDeckSync, demoDeck, hasFrames } from './decks'
import { normalizeDeck } from './lib/normalize.mjs'

// Two modes, discriminated by the ?slide= param:
//  - ?slide=N present -> SINGLE-SLIDE: render only that slide's frame, no player
//    chrome. Every screenshot script uses this path, so it must stay identical
//    to earlier phases (the pipeline captures the [data-slide-frame] element).
//  - otherwise -> interactive PLAYER. Deck comes from window injection,
//    ?deck=<example>, or the play server's /__deck.json.

function SingleSlide({
  deck,
  index,
  theme,
}: {
  deck: Deck
  index: number
  theme: 'dark' | 'light'
}) {
  // Normalize so scene decks expose their flattened step-slides to the
  // screenshot pipeline (idempotent for plain slide decks).
  const slides = normalizeDeck(deck).slides ?? []
  const clamped = Math.max(0, Math.min(index, slides.length - 1))
  return (
    <div
      data-theme={theme}
      className="flex min-h-screen items-center justify-center p-8"
      style={{ background: 'var(--vl-page-bg)' }}
    >
      <div className="shadow-2xl ring-1" style={{ '--tw-ring-color': 'var(--vl-ring)' } as CSSProperties}>
        <SlideRenderer
          slide={slides[clamped]}
          theme={theme}
          deckMeta={deck.meta}
          stepIndex={clamped}
          stepTotal={slides.length}
        />
      </div>
    </div>
  )
}

function PlayerLoader() {
  const [deck, setDeck] = useState<Deck | null>(() => resolveDeckSync())

  useEffect(() => {
    if (deck) return
    // Play server mode: fetch the deck it is serving.
    fetch('/__deck.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDeck(hasFrames(d) ? d : demoDeck))
      .catch(() => setDeck(demoDeck))
  }, [deck])

  if (!deck) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400"
        data-loading
      >
        Loading deck…
      </div>
    )
  }
  return <Player deck={deck} />
}

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const slideParam = params.get('slide')
  if (slideParam !== null) {
    const theme = params.get('theme') === 'light' ? 'light' : 'dark'
    return (
      <SingleSlide deck={resolveDeckSync() ?? demoDeck} index={Number(slideParam)} theme={theme} />
    )
  }
  return <PlayerLoader />
}
