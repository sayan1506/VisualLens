import type { CodePanelProps } from '../types/deck'
import { useHover } from './HoverContext'

export default function CodePanel({
  lines,
  activeLine,
  title,
  description,
}: CodePanelProps & { description?: string }) {
  const hover = useHover(description ? { title: title || 'Code', body: description } : null)
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60" {...hover}>
      {title && (
        <div className="border-b border-slate-800 px-5 py-2 text-sm font-medium text-slate-400">
          {title}
        </div>
      )}
      <pre className="p-5 font-mono text-lg leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex gap-4 rounded px-2 ${i === activeLine ? 'bg-amber-400/15' : ''}`}
          >
            <span className="w-6 shrink-0 select-none text-right text-slate-600">{i}</span>
            <span className={i === activeLine ? 'text-amber-200' : 'text-slate-300'}>
              {line || ' '}
            </span>
          </div>
        ))}
      </pre>
    </div>
  )
}
