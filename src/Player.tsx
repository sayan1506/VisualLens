import { useCallback, useEffect, useMemo, useState } from 'react'
import SlideRenderer from './slides/SlideRenderer'
import type { Deck } from './types/deck'
import { normalizeDeck } from './lib/normalize.mjs'
import { HoverProvider, type HoverInfo } from './components/HoverContext'

// Interactive deck player. Reuses the exact same SlideRenderer/components that
// the screenshot pipeline uses — this is the Path A payoff: build the catalog
// once, get PNGs and an interactive view from the same code.
export default function Player({ deck }: { deck: Deck }) {
  // Scene decks flatten to step-slides here; components share stable ids across
  // steps, so React patches values in place (the scoreboard) as `i` changes.
  const slides = useMemo(() => normalizeDeck(deck).slides ?? [], [deck])
  const n = slides.length
  const canvas = deck.meta.canvas ?? { width: 1280, height: 720 }
  const { width, height } = canvas

  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scale, setScale] = useState(1)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark',
  )

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
    <HoverProvider value={setHover}>
      <div
        data-theme={theme}
        className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-8"
        style={{ background: 'var(--vl-page-bg)' }}
        data-player
      >
        <button
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          data-theme-toggle
          aria-label="Toggle light/dark theme"
          className={`${btn} vl-btn absolute right-6 top-6 border`}
          style={{ borderColor: 'var(--vl-border)' }}
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>

        <div style={{ width: width * scale, height: height * scale }} className="relative">
          <div
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              // @ts-expect-error CSS custom property for the Tailwind ring color
              '--tw-ring-color': 'var(--vl-ring)',
            }}
            className="absolute left-0 top-0 overflow-hidden rounded-lg shadow-2xl ring-1"
          >
            <SlideRenderer
              slide={slides[i]}
              theme={theme}
              deckMeta={deck.meta}
              stepIndex={i}
              stepTotal={n}
            />
          </div>
        </div>

        {/* Info panel: shows the hovered/focused element's description, else a hint. */}
        <div
          className="min-h-[3.75rem] w-full max-w-2xl rounded-xl border px-5 py-3"
          style={{ borderColor: 'var(--vl-border)', backgroundColor: 'var(--vl-surface)' }}
          data-info
        >
          {hover ? (
            <>
              <div
                className="text-xs uppercase tracking-widest"
                style={{ color: 'var(--vl-text-faint)' }}
              >
                {hover.title}
              </div>
              <div className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--vl-text)' }}>
                {hover.body}
              </div>
            </>
          ) : (
            <div className="text-sm" style={{ color: 'var(--vl-text-faint)' }}>
              Hover, tap, or focus any element to see what it means.
            </div>
          )}
        </div>

        <div className="flex items-center gap-3" data-controls>
          <button onClick={() => go(i - 1)} disabled={i === 0} data-prev className={`${btn} vl-btn`}>
            ‹ Prev
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            data-playpause
            className={`${btn} vl-btn-accent`}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => go(i + 1)}
            disabled={i === n - 1}
            data-next
            className={`${btn} vl-btn`}
          >
            Next ›
          </button>
          <span className="ml-2 font-mono text-sm" style={{ color: 'var(--vl-text-muted)' }} data-counter>
            {i + 1} / {n}
          </span>
        </div>

        <div className="flex max-w-3xl flex-wrap justify-center gap-2" data-dots>
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => go(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="h-2.5 w-2.5 rounded-full transition-colors"
              style={{ backgroundColor: idx === i ? 'var(--vl-dot-active)' : 'var(--vl-dot)' }}
            />
          ))}
        </div>
      </div>
    </HoverProvider>
  )
}
