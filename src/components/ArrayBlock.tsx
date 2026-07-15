import type { ArrayBlockProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const BOX = 72 // px
const GAP = 12 // px
const BOX_AREA_H = 100 // box + index label
const POINTER_ROW_H = 46 // one arrow+pill row; stacked pointers add another

// Center x of column `i`, shared by boxes and the pointer overlay so an arrow
// lines up exactly under its box and can glide between columns.
const centerX = (i: number) => i * (BOX + GAP) + BOX / 2

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// Value boxes in a row with a pointer overlay beneath. The overlay uses ONE
// persistent node per pointer (keyed by label) positioned absolutely by index,
// with a CSS transition on `left` — so when a step patches a pointer's index it
// GLIDES to the new column instead of snapping. Highlights cross-fade and a
// changed value pops (keyed by value → remount → replay `vl-value-pop`). This
// is what makes a step read as "the board updated", not "a new slide".
// Soft per-cell fill tints (Dutch-flag / bucket coloring). Kept translucent so a
// highlight ring still reads on top of a tinted cell.
const fillTint: Record<ColorName, { bg: string; border: string }> = {
  orange: { bg: 'rgba(227, 179, 65, 0.22)', border: 'var(--pointer-orange)' },
  blue: { bg: 'rgba(143, 184, 214, 0.22)', border: 'var(--pointer-blue)' },
  green: { bg: 'rgba(134, 199, 162, 0.22)', border: 'var(--pointer-green)' },
  red: { bg: 'rgba(226, 154, 136, 0.22)', border: 'var(--pointer-red)' },
}

export default function ArrayBlock({
  values,
  highlighted = [],
  pointers = [],
  label,
  notes = [],
  colors = [],
  description,
}: ArrayBlockProps & { description?: string }) {
  const set = useHoverSetter()
  const hi = new Set(highlighted)
  const n = values.length
  const rowWidth = n > 0 ? n * BOX + (n - 1) * GAP : BOX

  // Stack offset: pointers sharing an index fan downward instead of overlapping.
  let maxStack = 1
  const stackOffset = pointers.map((p, k) => {
    const off = pointers.slice(0, k).filter((q) => q.index === p.index).length
    maxStack = Math.max(maxStack, off + 1)
    return off
  })
  const frameH = BOX_AREA_H + maxStack * POINTER_ROW_H

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div
          className="text-sm uppercase tracking-widest"
          style={{ color: 'var(--vl-text-faint)' }}
        >
          {label}
        </div>
      )}

      <div className="relative" style={{ width: rowWidth, height: frameH }}>
        {/* value boxes */}
        <div className="flex" style={{ gap: GAP }}>
          {values.map((v, i) => {
            const body = notes[i] ?? description ?? null
            const info = body ? { title: label ? `${label}[${i}]` : `Item ${i}`, body } : null
            const active = hi.has(i)
            const tint = colors[i] ? fillTint[colors[i] as ColorName] : null
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-lg"
                {...hoverHandlers(set, info)}
              >
                <div
                  className="flex items-center justify-center rounded-xl border-2 text-2xl font-semibold"
                  style={{
                    width: BOX,
                    height: BOX,
                    borderColor: active
                      ? 'var(--vl-highlight-border)'
                      : tint
                        ? tint.border
                        : 'var(--vl-box-border)',
                    backgroundColor: active
                      ? 'var(--vl-highlight-bg)'
                      : tint
                        ? tint.bg
                        : 'var(--vl-box-bg)',
                    color: active ? 'var(--vl-highlight-text)' : 'var(--vl-text)',
                    boxShadow: active ? '0 0 0 3px var(--vl-accent-soft)' : 'none',
                    transition:
                      'border-color 300ms ease, background-color 300ms ease, color 300ms ease, box-shadow 300ms ease',
                  }}
                >
                  <span key={String(v)} className="vl-value-pop inline-block">
                    {v}
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--vl-text-faint)' }}>
                  {i}
                </div>
              </div>
            )
          })}
        </div>

        {/* pointer overlay — persistent nodes that glide between columns */}
        {pointers.map((p, k) => (
          <div
            key={p.label}
            className="flex flex-col items-center"
            style={{
              position: 'absolute',
              left: centerX(p.index),
              top: BOX_AREA_H + stackOffset[k] * POINTER_ROW_H,
              transform: 'translateX(-50%)',
              color: pointerColor[p.color],
              transition:
                'left 340ms cubic-bezier(0.22, 1, 0.36, 1), top 200ms ease, color 300ms ease',
            }}
          >
            <span className="text-lg leading-none">▲</span>
            <span
              className="rounded-md border px-2 py-0.5 text-sm font-bold"
              style={{ borderColor: 'currentColor' }}
            >
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
