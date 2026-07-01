import { useEffect, useState } from 'react'
import SlideRenderer from './slides/SlideRenderer'
import Player from './Player'
import type { Deck } from './types/deck'
import { resolveDeckSync, demoDeck } from './decks'

// Two modes, discriminated by the ?slide= param:
//  - ?slide=N present -> SINGLE-SLIDE: render only that slide's frame, no player
//    chrome. Every screenshot script uses this path, so it must stay identical
//    to earlier phases (the pipeline captures the [data-slide-frame] element).
//  - otherwise -> interactive PLAYER. Deck comes from window injection,
//    ?deck=<example>, or the play server's /__deck.json.

function SingleSlide({ deck, index }: { deck: Deck; index: number }) {
  const clamped = Math.max(0, Math.min(index, deck.slides.length - 1))
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <div className="shadow-2xl ring-1 ring-slate-800">
        <SlideRenderer slide={deck.slides[clamped]} />
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
      .then((d) => setDeck(d && Array.isArray(d.slides) ? d : demoDeck))
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
  const slideParam = new URLSearchParams(window.location.search).get('slide')
  if (slideParam !== null) {
    return <SingleSlide deck={resolveDeckSync() ?? demoDeck} index={Number(slideParam)} />
  }
  return <PlayerLoader />
}
