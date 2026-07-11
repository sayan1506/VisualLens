import type { StatePanelProps } from '../types/deck'
import { useHover } from './HoverContext'

export default function StatePanel({
  vars,
  title = 'State',
  description,
}: StatePanelProps & { description?: string }) {
  const hover = useHover(description ? { title, body: description } : null)
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--vl-border)', backgroundColor: 'var(--vl-surface)' }}
      {...hover}
    >
      <div
        className="mb-3 text-sm uppercase tracking-widest"
        style={{ color: 'var(--vl-text-faint)' }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-2">
        {Object.entries(vars).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 font-mono">
            <span style={{ color: 'var(--vl-text-muted)' }}>{k}</span>
            <span key={String(v)} className="vl-value-pop text-lg font-semibold" style={{ color: 'var(--vl-text)' }}>
              {String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
