import type { StackProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const BOX = 72 // px, box edge (matches ArrayBlock/LinkedList)
const VGAP = 8 // px, vertical gap between stacked boxes
const FLOOR_SPACE = 14 // px, room for the floor baseline below index 0
const INDEX_W = 22 // px, left index-label strip
const POINTER_COL_W = 92 // px, horizontal room per stacked right-side pointer

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// A LIFO stack drawn as a vertical column anchored to a floor: values[0] is the
// BOTTOM (just above the floor) and values[n-1] is the TOP. Each box is placed
// by its `bottom` offset, which depends ONLY on its index — so existing boxes
// never move when the stack grows: a pushed value pops in on top and a popped
// value leaves from the top (React reconciles same-index boxes in place, the
// same scoreboard model as ArrayBlock). Pointers (e.g. `top`) sit to the right
// of their box and glide vertically between indices. Same highlight, value-pop,
// and hover model as the rest of the catalog. An empty stack (values: []) is
// valid and renders as a floor with an "empty" placeholder — a walkthrough
// often starts and ends with nothing on the stack.
export default function Stack({
  values,
  highlighted = [],
  pointers = [],
  label,
  notes = [],
  description,
}: StackProps & { description?: string }) {
  const set = useHoverSetter()
  const hi = new Set(highlighted)
  const n = values.length

  // Pointers sharing an index fan to the RIGHT instead of overlapping.
  let maxStack = 0
  const stackOffset = pointers.map((p, k) => {
    const off = pointers.slice(0, k).filter((q) => q.index === p.index).length
    maxStack = Math.max(maxStack, off + 1)
    return off
  })

  const colH = n > 0 ? n * BOX + (n - 1) * VGAP : BOX
  const frameH = FLOOR_SPACE + colH
  const boxLeft = INDEX_W + 8
  const rightZone = maxStack * POINTER_COL_W
  const frameW = boxLeft + BOX + rightZone
  const floorW = BOX + 16

  // bottom offset of box i (index 0 = bottom, just above the floor)
  const bottomOf = (i: number) => FLOOR_SPACE + i * (BOX + VGAP)

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
          {label}
        </div>
      )}

      <div className="relative" style={{ width: frameW, height: frameH }}>
        {/* floor baseline the stack sits on */}
        <div
          className="absolute rounded"
          style={{
            left: boxLeft - 8,
            bottom: 0,
            width: floorW,
            height: 4,
            backgroundColor: 'var(--vl-box-border)',
          }}
        />

        {/* empty-stack placeholder */}
        {n === 0 && (
          <div
            className="absolute flex items-center justify-center rounded-xl border-2 border-dashed text-sm"
            style={{
              left: boxLeft,
              bottom: FLOOR_SPACE,
              width: BOX,
              height: BOX,
              borderColor: 'var(--vl-box-border)',
              color: 'var(--vl-text-faint)',
            }}
          >
            empty
          </div>
        )}

        {/* value boxes: index 0 at the floor, top of stack highest */}
        {values.map((v, i) => {
          const body = notes[i] ?? description ?? null
          const isTop = i === n - 1
          const info = body
            ? { title: `${label ? `${label}[${i}]` : `Item ${i}`}${isTop ? ' (top)' : ''}`, body }
            : null
          const active = hi.has(i)
          return (
            <div key={i} {...hoverHandlers(set, info)}>
              {/* index label at the left */}
              <div
                className="absolute text-xs"
                style={{
                  left: 0,
                  bottom: bottomOf(i) + BOX / 2 - 8,
                  width: INDEX_W,
                  textAlign: 'right',
                  color: 'var(--vl-text-faint)',
                }}
              >
                {i}
              </div>
              <div
                className="absolute flex items-center justify-center rounded-xl border-2 text-2xl font-semibold"
                style={{
                  left: boxLeft,
                  bottom: bottomOf(i),
                  width: BOX,
                  height: BOX,
                  borderColor: active ? 'var(--vl-highlight-border)' : 'var(--vl-box-border)',
                  backgroundColor: active ? 'var(--vl-highlight-bg)' : 'var(--vl-box-bg)',
                  color: active ? 'var(--vl-highlight-text)' : 'var(--vl-text)',
                  boxShadow: active ? '0 0 0 3px var(--vl-accent-soft)' : 'none',
                  transition:
                    'border-color 300ms ease, background-color 300ms ease, color 300ms ease, box-shadow 300ms ease, bottom 300ms ease',
                }}
              >
                <span key={String(v)} className="vl-value-pop inline-block">
                  {v}
                </span>
              </div>
            </div>
          )
        })}

        {/* pointer overlay — right-side pills that glide vertically between boxes */}
        {pointers.map((p, k) => (
          <div
            key={p.label}
            className="absolute flex items-center gap-1"
            style={{
              left: boxLeft + BOX + 12 + stackOffset[k] * POINTER_COL_W,
              bottom: bottomOf(p.index) + BOX / 2,
              transform: 'translateY(50%)',
              color: pointerColor[p.color],
              transition: 'bottom 340ms cubic-bezier(0.22, 1, 0.36, 1), left 200ms ease, color 300ms ease',
            }}
          >
            <span className="text-lg leading-none">◀</span>
            <span className="rounded-md border px-2 py-0.5 text-sm font-bold" style={{ borderColor: 'currentColor' }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
