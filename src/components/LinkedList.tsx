import type { LinkedListProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const BOX = 72 // px, node box edge (matches ArrayBlock)
const GAP = 46 // px, gap between nodes — wider than an array to fit the next-arrow
const ARC_SPACE = 58 // px, room above the row for non-forward (backward/skip) arcs
const INDEX_H = 26 // px, index label strip below the boxes
const POINTER_ROW_H = 46 // px, one caret+pill row; stacked pointers add another
const NULL_STUB = 52 // px, room on the right for the tail→∅ stub

// Center x of node `i`, shared by boxes, arrows, and the pointer overlay so an
// arrow lands on a box edge exactly and a caret sits under its box.
const centerX = (i: number) => i * (BOX + GAP) + BOX / 2

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// A singly linked list. Node values are index-addressed like an array; `next` is
// a PARALLEL array of successor indices (next[i] = the node i points to, or null
// for the end). Omit `next` for the default forward chain 0→1→…→null. A next
// entry that is NOT i+1 (a backward or skipping link) renders as an ACCENT ARC
// above the row — which is exactly what makes reversal (arrows flip to arcs as
// they rewire backward) and cycle detection (a back-edge loop) read at a glance.
// highlighted/pointers/notes reuse the SAME index semantics as ArrayBlock, so
// slow/fast/prev/cur are ordinary gliding carets. The tail's null successor is a
// short stub to a ∅ glyph. Same theming, value-pop, and hover model as the rest.
export default function LinkedList({
  nodes,
  next,
  highlighted = [],
  pointers = [],
  label,
  notes = [],
  description,
}: LinkedListProps & { description?: string }) {
  const set = useHoverSetter()
  const hi = new Set(highlighted)
  const n = nodes.length

  // Resolve node i's successor. Provided next wins (undefined/out-of-range → null);
  // otherwise the default forward chain (last node → null).
  const succ = (i: number): number | null => {
    if (Array.isArray(next) && next.length > 0) {
      const v = next[i]
      if (v === null || v === undefined) return null
      return Number.isInteger(v) && v >= 0 && v < n && v !== i ? v : null
    }
    return i + 1 < n ? i + 1 : null
  }

  const rowWidth = n > 0 ? n * BOX + (n - 1) * GAP : BOX
  const svgW = rowWidth + NULL_STUB
  const svgH = ARC_SPACE + BOX
  const boxTop = ARC_SPACE
  const midY = ARC_SPACE + BOX / 2

  // Pointers sharing an index fan downward instead of overlapping (as ArrayBlock).
  let maxStack = 1
  const stackOffset = pointers.map((p, k) => {
    const off = pointers.slice(0, k).filter((q) => q.index === p.index).length
    maxStack = Math.max(maxStack, off + 1)
    return off
  })
  const frameH = ARC_SPACE + BOX + INDEX_H + maxStack * POINTER_ROW_H

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
          {label}
        </div>
      )}

      <div className="relative" style={{ width: svgW, height: frameH }}>
        {/* value boxes (HTML, so we keep the value-pop + hover model) */}
        {nodes.map((v, i) => {
          const body = notes[i] ?? description ?? null
          const info = body ? { title: label ? `${label}[${i}]` : `Node ${i}`, body } : null
          const active = hi.has(i)
          return (
            <div key={i} {...hoverHandlers(set, info)}>
              <div
                className="absolute flex items-center justify-center rounded-xl border-2 text-2xl font-semibold"
                style={{
                  left: centerX(i) - BOX / 2,
                  top: boxTop,
                  width: BOX,
                  height: BOX,
                  borderColor: active ? 'var(--vl-highlight-border)' : 'var(--vl-box-border)',
                  backgroundColor: active ? 'var(--vl-highlight-bg)' : 'var(--vl-box-bg)',
                  color: active ? 'var(--vl-highlight-text)' : 'var(--vl-text)',
                  boxShadow: active ? '0 0 0 3px var(--vl-accent-soft)' : 'none',
                  cursor: info ? 'pointer' : 'default',
                  transition:
                    'border-color 300ms ease, background-color 300ms ease, color 300ms ease, box-shadow 300ms ease',
                }}
              >
                <span key={String(v)} className="vl-value-pop inline-block">
                  {v}
                </span>
              </div>
              <div
                className="absolute text-xs"
                style={{
                  left: centerX(i) - BOX / 2,
                  top: boxTop + BOX + 4,
                  width: BOX,
                  textAlign: 'center',
                  color: 'var(--vl-text-faint)',
                }}
              >
                {i}
              </div>
            </div>
          )
        })}

        {/* next-arrows overlay — on top of boxes but click-through */}
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="pointer-events-none absolute left-0 top-0"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker id="ll-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vl-box-border)" />
            </marker>
            <marker id="ll-arrow-accent" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vl-accent)" />
            </marker>
          </defs>

          {nodes.map((_, i) => {
            const to = succ(i)
            const rightEdge = centerX(i) + BOX / 2
            // tail → null: short neutral stub ending in a ∅ glyph
            if (to === null) {
              // Short stub that stays inside the inter-node gap (GAP=46), so a
              // MID-LIST node pointing to null (as during reversal: node 0 → null
              // while later nodes still sit to its right) can't overlap the next
              // box. The tail's ∅ lands in the reserved NULL_STUB margin.
              const x2 = rightEdge + 16
              return (
                <g key={`e${i}`}>
                  <line x1={rightEdge} y1={midY} x2={x2} y2={midY} stroke="var(--vl-box-border)" strokeWidth={2} markerEnd="url(#ll-arrow)" />
                  <text x={x2 + 12} y={midY} textAnchor="middle" dominantBaseline="central" fontSize={18} fill="var(--vl-text-faint)">
                    ∅
                  </text>
                </g>
              )
            }
            // forward-adjacent: straight neutral arrow through the gap
            if (to === i + 1) {
              const x2 = centerX(to) - BOX / 2 - 2
              return (
                <line
                  key={`e${i}`}
                  x1={rightEdge}
                  y1={midY}
                  x2={x2}
                  y2={midY}
                  stroke="var(--vl-box-border)"
                  strokeWidth={2}
                  markerEnd="url(#ll-arrow)"
                  style={{ transition: 'all 300ms ease' }}
                />
              )
            }
            // backward or skipping link: accent arc above the row (rewired / cycle edge)
            const x1 = centerX(i)
            const x2 = centerX(to)
            const dist = Math.abs(to - i)
            const peak = Math.min(ARC_SPACE - 6, 24 + dist * 8)
            const cx = (x1 + x2) / 2
            return (
              <path
                key={`e${i}`}
                d={`M ${x1} ${boxTop} Q ${cx} ${boxTop - peak} ${x2} ${boxTop}`}
                fill="none"
                stroke="var(--vl-accent)"
                strokeWidth={2.5}
                markerEnd="url(#ll-arrow-accent)"
                style={{ transition: 'all 300ms ease' }}
              />
            )
          })}
        </svg>

        {/* pointer overlay — persistent carets that glide between nodes */}
        {pointers.map((p, k) => (
          <div
            key={p.label}
            className="flex flex-col items-center"
            style={{
              position: 'absolute',
              left: centerX(p.index),
              top: ARC_SPACE + BOX + INDEX_H + stackOffset[k] * POINTER_ROW_H,
              transform: 'translateX(-50%)',
              color: pointerColor[p.color],
              transition: 'left 340ms cubic-bezier(0.22, 1, 0.36, 1), top 200ms ease, color 300ms ease',
            }}
          >
            <span className="text-lg leading-none">▲</span>
            <span className="rounded-md border px-2 py-0.5 text-sm font-bold" style={{ borderColor: 'currentColor' }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
