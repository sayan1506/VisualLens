import type { BarChartProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const BAR_W = 56 // px, bar column width
const GAP = 14 // px, gap between bars
const PLOT_H = 300 // px, tallest bar height
const POINTER_ROW_H = 46
const LABEL_H = 24

const centerX = (i: number) => i * (BAR_W + GAP) + BAR_W / 2

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// A histogram whose bar heights are proportional to their values. Reuses the
// array pointer model (labeled carets under a column that glide when their
// index is patched). `overlay` shades the span [from..to] as the "water" a
// container holds; `maxLine` draws a horizontal reference at a value (the
// running best). This is what Container With Most Water / Trapping Rain Water /
// sorting / stock problems need and the array-only catalog couldn't express.
export default function BarChart({
  values,
  highlighted = [],
  pointers = [],
  label,
  notes = [],
  overlay,
  maxLine,
  description,
}: BarChartProps & { description?: string }) {
  const set = useHoverSetter()
  const hi = new Set(highlighted)
  const n = values.length
  const rowWidth = n > 0 ? n * BAR_W + (n - 1) * GAP : BAR_W
  const maxVal = Math.max(1, ...values.map((v) => (Number.isFinite(v) ? v : 0)))
  const barH = (v: number) => Math.max(2, (Math.max(0, v) / maxVal) * PLOT_H)

  let maxStack = 1
  const stackOffset = pointers.map((p, k) => {
    const off = pointers.slice(0, k).filter((q) => q.index === p.index).length
    maxStack = Math.max(maxStack, off + 1)
    return off
  })

  const plotAreaH = PLOT_H + LABEL_H
  const frameH = plotAreaH + maxStack * POINTER_ROW_H

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
          {label}
        </div>
      )}

      <div className="relative" style={{ width: rowWidth, height: frameH }}>
        {/* overlay shaded region (e.g. the water a container holds) */}
        {overlay && overlay.to >= overlay.from && (
          <div
            className="absolute rounded-md"
            style={{
              left: centerX(overlay.from),
              width: centerX(overlay.to) - centerX(overlay.from),
              top: 0,
              height: PLOT_H,
              background: 'var(--vl-info-bg)',
              border: '1px dashed var(--vl-info-border)',
              transition: 'left 340ms ease, width 340ms ease',
            }}
          >
            {overlay.label && (
              <div
                className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold"
                style={{ color: 'var(--vl-info-text)' }}
              >
                {overlay.label}
              </div>
            )}
          </div>
        )}

        {/* max reference line */}
        {maxLine && (
          <div
            className="absolute left-0 flex w-full items-center"
            style={{
              top: PLOT_H - barH(maxLine.value),
              transition: 'top 340ms ease',
            }}
          >
            <div className="w-full border-t-2 border-dashed" style={{ borderColor: 'var(--vl-accent)' }} />
            {maxLine.label && (
              <span
                className="absolute right-0 -translate-y-4 whitespace-nowrap text-xs font-semibold"
                style={{ color: 'var(--vl-accent-text)' }}
              >
                {maxLine.label}
              </span>
            )}
          </div>
        )}

        {/* bars, aligned to a shared baseline */}
        <div className="absolute inset-x-0 flex" style={{ gap: GAP, top: 0, height: plotAreaH }}>
          {values.map((v, i) => {
            const body = notes[i] ?? description ?? null
            const info = body ? { title: label ? `${label}[${i}]` : `Bar ${i}`, body } : null
            const active = hi.has(i)
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-end"
                style={{ width: BAR_W, height: plotAreaH }}
                {...hoverHandlers(set, info)}
              >
                <span className="mb-1 text-sm font-semibold" style={{ color: 'var(--vl-text-muted)' }}>
                  {v}
                </span>
                <div
                  key={String(v)}
                  className="w-full rounded-t-md border-2"
                  style={{
                    height: barH(v),
                    borderColor: active ? 'var(--vl-highlight-border)' : 'var(--vl-box-border)',
                    backgroundColor: active ? 'var(--vl-highlight-bg)' : 'var(--vl-box-bg)',
                    boxShadow: active ? '0 0 0 3px var(--vl-accent-soft)' : 'none',
                    transition: 'height 300ms ease, border-color 300ms ease, background-color 300ms ease',
                  }}
                />
                <div className="mt-1 text-xs" style={{ color: 'var(--vl-text-faint)' }}>
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
              top: plotAreaH + stackOffset[k] * POINTER_ROW_H,
              transform: 'translateX(-50%)',
              color: pointerColor[p.color],
              transition: 'left 340ms cubic-bezier(0.22, 1, 0.36, 1), top 200ms ease, color 300ms ease',
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
