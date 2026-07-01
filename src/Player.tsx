import { useCallback, useEffect, useState } from 'react'
import SlideRenderer from './slides/SlideRenderer'
import type { Deck } from './types/deck'

// Interactive deck player. Reuses the exact same SlideRenderer/components that
// the screenshot pipeline uses — this is the Path A payoff: build the catalog
// once, get PNGs and an interactive view from the same code.
export default function Player({ deck }: { deck: Deck }) {
  const n = deck.slides.length
  const canvas = deck.meta.canvas ?? { width: 1280, height: 720 }
  const { width, height } = canvas

  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scale, setScale] = useState(1)

  const go = useCallback((next: number) => setI(() => Math.max(0, Math.min(next, n - 1))), [n])

  // Scale the fixed-size canvas down to fit the viewport (never up past 1:1).
  useEffect(() => {
    const fit = () => {
      const availW = window.innerWidth - 64
      const availH = window.innerHeight - 160 // leave room for controls
      setScale(Math.min(1, availW / width, availH / height))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [width, height])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        go(i + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(i - 1)
      } else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go, n])

  useEffect(() => {
    if (!playing) return
    if (i >= n - 1) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => go(i + 1), 1500)
    return () => clearTimeout(t)
  }, [playing, i, n, go])

  const btn =
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-8"
      data-player
    >
      <div style={{ width: width * scale, height: height * scale }} className="relative">
        <div
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          className="absolute left-0 top-0 overflow-hidden rounded-lg shadow-2xl ring-1 ring-slate-800"
        >
          <SlideRenderer slide={deck.slides[i]} />
        </div>
      </div>

      <div className="flex items-center gap-3" data-controls>
        <button
          onClick={() => go(i - 1)}
          disabled={i === 0}
          data-prev
          className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}
        >
          ‹ Prev
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          data-playpause
          className={`${btn} bg-sky-600 text-white hover:bg-sky-500`}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => go(i + 1)}
          disabled={i === n - 1}
          data-next
          className={`${btn} bg-slate-800 text-slate-200 hover:bg-slate-700`}
        >
          Next ›
        </button>
        <span className="ml-2 font-mono text-sm text-slate-400" data-counter>
          {i + 1} / {n}
        </span>
      </div>

      <div className="flex max-w-3xl flex-wrap justify-center gap-2" data-dots>
        {deck.slides.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => go(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              idx === i ? 'bg-sky-400' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
