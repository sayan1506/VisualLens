import type { GridProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const CELL = 58 // px, cell edge
const GAP = 8 // px, gap between cells
const AXIS = 30 // px, row-label column width / col-label row height when present

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// Soft per-cell fill tints, matching ArrayBlock. Kept translucent so a highlight
// ring or pointer ring still reads on top of a tinted cell.
const fillTint: Record<ColorName, { bg: string; border: string }> = {
  orange: { bg: 'rgba(227, 179, 65, 0.22)', border: 'var(--pointer-orange)' },
  blue: { bg: 'rgba(143, 184, 214, 0.22)', border: 'var(--pointer-blue)' },
  green: { bg: 'rgba(134, 199, 162, 0.22)', border: 'var(--pointer-green)' },
  red: { bg: 'rgba(226, 154, 136, 0.22)', border: 'var(--pointer-red)' },
}

// A 2D matrix given row-major (values[r][c]). Unlike array/tree (index) and graph
// (id), a grid position is a {row, col} PAIR, so highlighted/pointers/colors/notes
// are all cell-addressed. `null` marks a blocked/empty cell (maze wall, unfilled
// DP entry) — drawn dimmed and never highlighted. Pointers are persistent overlay
// nodes positioned absolutely by {row,col}, gliding via `left`/`top` transitions
// (the scoreboard effect); a changed value pops (keyed value → remount → replay
// `vl-value-pop`), which reads well for a DP table filling in.
export default function Grid({
  values,
  highlighted = [],
  pointers = [],
  label,
  colors = [],
  notes = [],
  rowLabels,
  colLabels,
  description,
}: GridProps & { description?: string }) {
  const set = useHoverSetter()
  const rows = values.length
  const cols = rows > 0 ? Math.max(0, ...values.map((r) => (Array.isArray(r) ? r.length : 0))) : 0

  const hi = new Set(highlighted.map((h) => `${h.row},${h.col}`))
  const hasRowLabels = Array.isArray(rowLabels) && rowLabels.length > 0
  const hasColLabels = Array.isArray(colLabels) && colLabels.length > 0
  const axisW = hasRowLabels ? AXIS : 0
  const axisH = hasColLabels ? AXIS : 0

  const cellX = (c: number) => axisW + c * (CELL + GAP)
  const cellY = (r: number) => axisH + r * (CELL + GAP)
  const plotW = cols > 0 ? cols * CELL + (cols - 1) * GAP : CELL
  const plotH = rows > 0 ? rows * CELL + (rows - 1) * GAP : CELL
  const frameW = axisW + plotW
  const frameH = axisH + plotH

  // Tags sharing a cell fan rightward so both labels stay readable.
  const tagOffset = pointers.map((p, k) =>
    pointers.slice(0, k).filter((q) => q.row === p.row && q.col === p.col).length,
  )

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
          {label}
        </div>
      )}

      <div className="relative" style={{ width: frameW, height: frameH }}>
        {/* column axis labels */}
        {hasColLabels &&
          Array.from({ length: cols }, (_, c) => (
            <div
              key={`cl${c}`}
              className="absolute flex items-center justify-center text-xs font-semibold"
              style={{ left: cellX(c), top: 0, width: CELL, height: axisH, color: 'var(--vl-text-faint)' }}
            >
              {colLabels![c] ?? ''}
            </div>
          ))}

        {/* row axis labels */}
        {hasRowLabels &&
          Array.from({ length: rows }, (_, r) => (
            <div
              key={`rl${r}`}
              className="absolute flex items-center justify-center text-xs font-semibold"
              style={{ left: 0, top: cellY(r), width: axisW, height: CELL, color: 'var(--vl-text-faint)' }}
            >
              {rowLabels![r] ?? ''}
            </div>
          ))}

        {/* cells */}
        {values.map((rowVals, r) =>
          Array.from({ length: cols }, (_, c) => {
            const v = Array.isArray(rowVals) ? rowVals[c] : null
            const blocked = v === null || v === undefined
            const active = hi.has(`${r},${c}`)
            const tint = !blocked && colors[r]?.[c] ? fillTint[colors[r]![c] as ColorName] : null
            const body = notes[r]?.[c] ?? description ?? null
            const info = body ? { title: label ? `${label}[${r}][${c}]` : `Cell ${r},${c}`, body } : null
            return (
              <div
                key={`${r}-${c}`}
                className="absolute flex items-center justify-center rounded-lg border-2 text-xl font-semibold"
                {...hoverHandlers(set, info)}
                style={{
                  left: cellX(c),
                  top: cellY(r),
                  width: CELL,
                  height: CELL,
                  borderColor: active
                    ? 'var(--vl-highlight-border)'
                    : tint
                      ? tint.border
                      : 'var(--vl-box-border)',
                  backgroundColor: blocked
                    ? 'var(--vl-surface-alt)'
                    : active
                      ? 'var(--vl-highlight-bg)'
                      : tint
                        ? tint.bg
                        : 'var(--vl-box-bg)',
                  color: active ? 'var(--vl-highlight-text)' : 'var(--vl-text)',
                  opacity: blocked ? 0.5 : 1,
                  boxShadow: active ? '0 0 0 3px var(--vl-accent-soft)' : 'none',
                  cursor: info ? 'pointer' : 'default',
                  transition:
                    'border-color 300ms ease, background-color 300ms ease, color 300ms ease, box-shadow 300ms ease',
                }}
              >
                {!blocked && (
                  <span key={String(v)} className="vl-value-pop inline-block">
                    {v}
                  </span>
                )}
              </div>
            )
          }),
        )}

        {/* pointer overlay — persistent ring per label that glides between cells */}
        {pointers.map((p, k) => (
          <div
            key={p.label}
            className="pointer-events-none absolute rounded-lg border-[3px]"
            style={{
              left: cellX(p.col),
              top: cellY(p.row),
              width: CELL,
              height: CELL,
              borderColor: pointerColor[p.color],
              transition:
                'left 340ms cubic-bezier(0.22, 1, 0.36, 1), top 340ms cubic-bezier(0.22, 1, 0.36, 1), border-color 300ms ease',
            }}
          >
            <span
              className="absolute whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-bold leading-none"
              style={{
                left: 3 + tagOffset[k] * 4,
                top: 3,
                color: pointerColor[p.color],
                borderColor: 'currentColor',
                backgroundColor: 'var(--vl-box-bg)',
              }}
            >
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
