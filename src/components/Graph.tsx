import type { GraphProps, ColorName } from '../types/deck'
import { hoverHandlers, useHoverSetter } from './HoverContext'

const NODE_R = 26
// Sized so a graph + state_panel + caption callout stack fits the fixed canvas
// height in the vertically-centered array_state layout (a taller plot pushes the
// trailing caption off the bottom edge).
const PLOT_W = 540 // normalized [0,1] positions map onto this plotting area
const PLOT_H = 220
const PAD = NODE_R + 20 // keep nodes off the edge so labels/pointers fit

const pointerColor: Record<ColorName, string> = {
  orange: 'var(--pointer-orange)',
  blue: 'var(--pointer-blue)',
  green: 'var(--pointer-green)',
  red: 'var(--pointer-red)',
}

// A general graph with author-supplied node positions in normalized [0,1] space
// (0,0 = top-left). Unlike tree/array, `highlighted` and pointers reference node
// IDS, not indices, because a graph has no natural ordering. Edges reference
// ids too and may be directed (arrowhead) and/or weighted (mid-edge label).
// Same theming + hover model as the other components; pointer <g> nodes are
// persistent and glide via a transform transition (the scoreboard effect).
export default function Graph({
  nodes,
  edges = [],
  highlighted = [],
  pointers = [],
  label,
  notes = {},
  description,
}: GraphProps & { description?: string }) {
  const set = useHoverSetter()
  const hi = new Set(highlighted)
  const pos = new Map(nodes.map((n) => [n.id, n]))

  const svgW = PLOT_W + PAD * 2
  const svgH = PLOT_H + PAD * 2
  const px = (x: number) => PAD + Math.max(0, Math.min(1, x)) * PLOT_W
  const py = (y: number) => PAD + Math.max(0, Math.min(1, y)) * PLOT_H

  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--vl-text-faint)' }}>
          {label}
        </div>
      )}
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: 'visible' }}>
        <defs>
          <marker
            id="vl-arrow"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--vl-box-border)" />
          </marker>
        </defs>

        {/* edges beneath nodes; endpoints pulled back to the node rim so a
            directed arrowhead lands on the border, not the center */}
        {edges.map((e, k) => {
          const a = pos.get(e.from)
          const b = pos.get(e.to)
          if (!a || !b) return null
          const x1 = px(a.x)
          const y1 = py(a.y)
          const x2 = px(b.x)
          const y2 = py(b.y)
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len
          const uy = dy / len
          const sx = x1 + ux * NODE_R
          const sy = y1 + uy * NODE_R
          const tx = x2 - ux * NODE_R
          const ty = y2 - uy * NODE_R
          return (
            <g key={`e${k}`}>
              <line
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke="var(--vl-box-border)"
                strokeWidth={2}
                markerEnd={e.directed ? 'url(#vl-arrow)' : undefined}
              />
              {e.weight !== undefined && (
                <text
                  x={(sx + tx) / 2}
                  y={(sy + ty) / 2 - 6}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--vl-text-muted)"
                >
                  {String(e.weight)}
                </text>
              )}
            </g>
          )
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const active = hi.has(n.id)
          const body = notes[n.id] ?? description ?? null
          const info = body ? { title: label ? `${label}: ${n.id}` : `Node ${n.id}`, body } : null
          return (
            <g key={`n${n.id}`} {...hoverHandlers(set, info)} style={{ cursor: info ? 'pointer' : 'default' }}>
              <circle
                cx={px(n.x)}
                cy={py(n.y)}
                r={NODE_R}
                fill={active ? 'var(--vl-highlight-bg)' : 'var(--vl-box-bg)'}
                stroke={active ? 'var(--vl-highlight-border)' : 'var(--vl-box-border)'}
                strokeWidth={active ? 3 : 2}
                style={{ transition: 'fill 300ms ease, stroke 300ms ease' }}
              />
              <text
                x={px(n.x)}
                y={py(n.y)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={17}
                fontWeight={600}
                fill={active ? 'var(--vl-highlight-text)' : 'var(--vl-text)'}
                style={{ transition: 'fill 300ms ease' }}
              >
                {String(n.value ?? n.id)}
              </text>
            </g>
          )
        })}

        {/* pointers: persistent group per label, glides between nodes */}
        {pointers.map((p) => {
          const n = pos.get(p.node)
          if (!n) return null
          return (
            <g
              key={`p${p.label}`}
              transform={`translate(${px(n.x)}, ${py(n.y)})`}
              style={{
                transition: 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)',
                color: pointerColor[p.color],
              }}
            >
              <text x={0} y={-NODE_R - 22} textAnchor="middle" fontSize={13} fontWeight={700} fill="currentColor">
                {p.label}
              </text>
              <polygon points={`-5,${-NODE_R - 14} 5,${-NODE_R - 14} 0,${-NODE_R - 5}`} fill="currentColor" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
