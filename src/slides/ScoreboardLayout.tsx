import type { ComponentInstance, DeckMeta, Difficulty } from '../types/deck'
import FitToWidth from '../components/FitToWidth'
import { renderComponent } from './renderComponent'

// Difficulty badge palette (Chai-style: easy green / medium amber / hard red).
const difficultyStyle: Record<Difficulty, { bg: string; border: string; text: string }> = {
  easy: { bg: 'var(--vl-success-bg)', border: 'var(--vl-success-border)', text: 'var(--vl-success-text)' },
  medium: { bg: 'var(--vl-warn-bg)', border: 'var(--vl-warn-border)', text: 'var(--vl-warn-text)' },
  hard: { bg: 'var(--vl-info-bg)', border: 'var(--vl-info-border)', text: 'var(--vl-info-text)' },
}

// The docked "scoreboard" layout: a persistent header band, the visualization
// on the left, code + state docked on the right, and the step caption in a
// narration strip along the bottom — all on screen at once, every step. Used
// for the step-through templates (array_state, code_walk); the framing
// templates (title, concept) keep the centered order-based TemplateLayout.
//
// Components are partitioned by ROLE (their type), not by JSON order, so the
// same authored decks render into zones with no JSON changes. Each zone
// degrades gracefully when empty: no dock -> viz spans full width; no viz ->
// dock centers; no caption -> no strip.

interface ScoreboardLayoutProps {
  components: ComponentInstance[]
  deckMeta?: Pick<DeckMeta, 'title' | 'difficulty' | 'complexity'>
  stepIndex?: number
  stepTotal?: number
}

export default function ScoreboardLayout({
  components,
  deckMeta,
  stepIndex,
  stepTotal,
}: ScoreboardLayoutProps) {
  const header: ComponentInstance[] = []
  const viz: ComponentInstance[] = []
  const dock: ComponentInstance[] = []
  const strip: ComponentInstance[] = []

  for (const c of components) {
    switch (c.type) {
      case 'title_block':
        header.push(c)
        break
      case 'code_panel':
      case 'state_panel':
        dock.push(c)
        break
      case 'callout':
      case 'text':
        strip.push(c)
        break
      default:
        viz.push(c) // array_block, tree, graph (+ future bar_chart)
    }
  }

  const problemTitle =
    deckMeta?.title ??
    (header.find((c) => c.type === 'title_block')?.props as { title?: string } | undefined)?.title

  return (
    <div className="flex h-full w-full flex-col">
      {/* header band — persistent problem title + step counter */}
      {(problemTitle || (stepTotal ?? 0) > 0) && (
        <div
          className="flex items-baseline justify-between border-b px-10 py-4"
          style={{ borderColor: 'var(--vl-border)', backgroundColor: 'var(--vl-surface-alt)' }}
        >
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
              Problem
            </div>
            <div className="flex items-center gap-3">
              {problemTitle && (
                <div className="truncate text-2xl font-semibold" style={{ color: 'var(--vl-text)' }}>
                  {problemTitle}
                </div>
              )}
              {deckMeta?.difficulty && (
                <span
                  className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: difficultyStyle[deckMeta.difficulty].bg,
                    borderColor: difficultyStyle[deckMeta.difficulty].border,
                    color: difficultyStyle[deckMeta.difficulty].text,
                  }}
                >
                  {deckMeta.difficulty}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {(deckMeta?.complexity?.time || deckMeta?.complexity?.space) && (
              <div className="flex gap-2 font-mono text-xs">
                {deckMeta.complexity.time && (
                  <span
                    className="rounded-md border px-2 py-1"
                    style={{ borderColor: 'var(--vl-border)', color: 'var(--vl-text-muted)' }}
                  >
                    time {deckMeta.complexity.time}
                  </span>
                )}
                {deckMeta.complexity.space && (
                  <span
                    className="rounded-md border px-2 py-1"
                    style={{ borderColor: 'var(--vl-border)', color: 'var(--vl-text-muted)' }}
                  >
                    space {deckMeta.complexity.space}
                  </span>
                )}
              </div>
            )}
            {(stepTotal ?? 0) > 0 && (
              <div className="font-mono text-sm" style={{ color: 'var(--vl-text-muted)' }}>
                step {(stepIndex ?? 0) + 1} / {stepTotal}
              </div>
            )}
          </div>
        </div>
      )}

      {/* middle row — viz (left) + dock (right) */}
      <div className="flex min-h-0 flex-1">
        {viz.length > 0 && (
          <div className="flex min-w-0 flex-1 flex-col gap-6 p-8">
            {viz.map((c, i) => (
              <div key={c.id ?? `viz-${i}`} className="min-h-0 w-full flex-1">
                <FitToWidth>{renderComponent(c, c.id ?? `viz-${i}`)}</FitToWidth>
              </div>
            ))}
          </div>
        )}
        {dock.length > 0 && (
          <div
            className="flex shrink-0 flex-col justify-center gap-4 border-l p-6"
            style={{
              borderColor: 'var(--vl-border)',
              width: viz.length > 0 ? 420 : '100%',
            }}
          >
            {dock.map((c, i) => renderComponent(c, c.id ?? `dock-${i}`))}
          </div>
        )}
      </div>

      {/* narration strip — the step caption */}
      {strip.length > 0 && (
        <div
          className="flex flex-col gap-2 border-t px-10 py-4"
          style={{ borderColor: 'var(--vl-border)', backgroundColor: 'var(--vl-surface-alt)' }}
        >
          {strip.map((c, i) => renderComponent(c, c.id ?? `strip-${i}`))}
        </div>
      )}
    </div>
  )
}
