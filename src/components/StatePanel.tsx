import type { StatePanelProps } from '../types/deck'
import { useHover } from './HoverContext'

export default function StatePanel({
  vars,
  title = 'State',
  description,
}: StatePanelProps & { description?: string }) {
  const hover = useHover(description ? { title, body: description } : null)
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5" {...hover}>
      <div className="mb-3 text-sm uppercase tracking-widest text-slate-500">{title}</div>
      <div className="flex flex-col gap-2">
        {Object.entries(vars).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 font-mono">
            <span className="text-slate-400">{k}</span>
            <span className="text-lg font-semibold text-white">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
