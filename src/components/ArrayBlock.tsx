import type { ArrayBlockProps, ColorName } from '../types/deck'

const BOX = 72 // px
const GAP = 12 // px

const pointerText: Record<ColorName, string> = {
  orange: 'text-orange-400',
  blue: 'text-sky-400',
  green: 'text-emerald-400',
  red: 'text-rose-400',
}

const pointerBorder: Record<ColorName, string> = {
  orange: 'border-orange-400',
  blue: 'border-sky-400',
  green: 'border-emerald-400',
  red: 'border-rose-400',
}

// Value boxes in a row, index labels beneath, pointer arrows stacked below the
// column they point at. Column widths/gaps are shared so everything stays aligned.
export default function ArrayBlock({
  values,
  highlighted = [],
  pointers = [],
  label,
}: ArrayBlockProps) {
  const hi = new Set(highlighted)
  return (
    <div className="flex flex-col items-center gap-3">
      {label && (
        <div className="text-sm uppercase tracking-widest text-slate-500">{label}</div>
      )}
      <div className="flex" style={{ gap: GAP }}>
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div
              className={`flex items-center justify-center rounded-xl border-2 text-2xl font-semibold ${
                hi.has(i)
                  ? 'border-rose-400 bg-rose-400/20 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-200'
              }`}
              style={{ width: BOX, height: BOX }}
            >
              {v}
            </div>
            <div className="text-xs text-slate-600">{i}</div>
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: GAP }}>
        {values.map((_, i) => {
          const here = pointers.filter((p) => p.index === i)
          return (
            <div key={i} className="flex flex-col items-center gap-1" style={{ width: BOX }}>
              {here.map((p) => (
                <div key={p.label} className={`flex flex-col items-center ${pointerText[p.color]}`}>
                  <span className="text-lg leading-none">▲</span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-sm font-bold ${pointerBorder[p.color]}`}
                  >
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
