import type { TreeProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const NODE_R = 26
const LEVEL_H = 96
const COL_W = 68
const POINTER_SPACE = 40 // vertical room above the root for pointer pills

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// A binary tree from a LeetCode-style level-order array: index 0 is the root,
// node i's children are at 2i+1 / 2i+2, and `null` marks a missing node. Column
// x-positions come from an IN-ORDER walk of the existing nodes, so parents sit
// between their children and nothing overlaps regardless of tree shape — authors
// only supply the array, never coordinates. Same theming + hover model as
// ArrayBlock. `highlighted` and each `pointer.index` reference the SAME
// level-order indices (a null slot must not be referenced). Pointers are
// persistent <g> nodes positioned by transform with a CSS transition, so a step
// that moves a pointer to another node GLIDES it (the scoreboard effect).
export default function Tree({
  nodes,
  highlighted = [],
  pointers = [],
  label,
  notes = [],
  description,
}: TreeProps & { description?: string }) {
  const set = useHoverSetter()
  const hi = new Set(highlighted)

  const exists = (i: number) =>
    i >= 0 && i < nodes.length && nodes[i] !== null && nodes[i] !== undefined

  // In-order x assignment: visit left subtree, take the next column, then right.
  const xIndex = new Map<number, number>()
  let col = 0
  const assign = (i: number) => {
    if (!exists(i)) return
    assign(2 * i + 1)
    xIndex.set(i, col++)
    assign(2 * i + 2)
  }
  assign(0)

  // Exact integer depth (avoids Math.log2 floating-point edge cases at 2^k).
  const depthOf = (i: number) => {
    let d = 0
    let n = i + 1
    while (n > 1) {
      n = Math.floor(n / 2)
      d++
    }
    return d
  }
  let maxDepth = 0
  for (const i of xIndex.keys()) maxDepth = Math.max(maxDepth, depthOf(i))

  const cols = Math.max(1, col)
  const svgW = cols * COL_W
  const svgH = (maxDepth + 1) * LEVEL_H + POINTER_SPACE
  const cx = (i: number) => (xIndex.get(i)! + 0.5) * COL_W
  const cy = (i: number) => depthOf(i) * LEVEL_H + LEVEL_H / 2 + POINTER_SPACE

  const present = [...xIndex.keys()]

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
          {label}
        </div>
      )}
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
        {/* edges: parent → each existing child, drawn beneath the nodes */}
        {present.flatMap((i) =>
          [2 * i + 1, 2 * i + 2]
            .filter((c) => exists(c))
            .map((c) => (
              <line
                key={`e${i}-${c}`}
                x1={cx(i)}
                y1={cy(i)}
                x2={cx(c)}
                y2={cy(c)}
                stroke="var(--vl-box-border)"
                strokeWidth={2}
              />
            )),
        )}

        {/* nodes */}
        {present.map((i) => {
          const active = hi.has(i)
          const body = notes[i] ?? description ?? null
          const info = body ? { title: label ? `${label}[${i}]` : `Node ${i}`, body } : null
          return (
            <g key={`n${i}`} {...hoverHandlers(set, info)} style={{ cursor: info ? 'pointer' : 'default' }}>
              <circle
                cx={cx(i)}
                cy={cy(i)}
                r={NODE_R}
                fill={active ? 'var(--vl-highlight-bg)' : 'var(--vl-box-bg)'}
                stroke={active ? 'var(--vl-highlight-border)' : 'var(--vl-box-border)'}
                strokeWidth={active ? 3 : 2}
                style={{ transition: 'fill 300ms ease, stroke 300ms ease' }}
              />
              <text
                x={cx(i)}
                y={cy(i)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={18}
                fontWeight={600}
                fill={active ? 'var(--vl-highlight-text)' : 'var(--vl-text)'}
                style={{ transition: 'fill 300ms ease' }}
              >
                {String(nodes[i])}
              </text>
            </g>
          )
        })}

        {/* pointers: persistent group per label, glides via transform transition */}
        {pointers.map((p) =>
          exists(p.index) ? (
            <g
              key={`p${p.label}`}
              transform={`translate(${cx(p.index)}, ${cy(p.index)})`}
              style={{
                transition: 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)',
                color: pointerColor[p.color],
              }}
            >
              <text
                x={0}
                y={-NODE_R - 22}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="currentColor"
              >
                {p.label}
              </text>
              <polygon
                points={`-5,${-NODE_R - 14} 5,${-NODE_R - 14} 0,${-NODE_R - 5}`}
                fill="currentColor"
              />
            </g>
          ) : null,
        )}
      </svg>
    </div>
  )
}
