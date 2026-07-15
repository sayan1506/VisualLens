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
    <div
      className="w-full overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--vl-border)', backgroundColor: 'var(--vl-surface-alt)' }}
      {...hover}
    >
      {title && (
        <div
          className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide"
          style={{ borderColor: 'var(--vl-border)', color: 'var(--vl-text-muted)' }}
        >
          {title}
        </div>
      )}
      <pre className="p-4 font-mono text-sm leading-6">
        {lines.map((line, i) => {
          const active = i === activeLine
          return (
            <div
              key={i}
              className="flex gap-3 rounded px-2"
              style={{
                backgroundColor: active ? 'var(--vl-accent-soft)' : 'transparent',
                transition: 'background-color 300ms ease',
              }}
            >
              <span
                className="w-6 shrink-0 select-none text-right"
                style={{ color: 'var(--vl-text-faint)' }}
              >
                {i}
              </span>
              <span
                style={{
                  color: active ? 'var(--vl-accent-text)' : 'var(--vl-text-muted)',
                  transition: 'color 300ms ease',
                }}
              >
                {line || ' '}
              </span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
