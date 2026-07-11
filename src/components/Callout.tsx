import type { CalloutProps } from '../types/deck'
import { useHover } from './HoverContext'

const variantVars: Record<CalloutProps['variant'], { border: string; bg: string; text: string }> = {
  info: { border: 'var(--vl-info-border)', bg: 'var(--vl-info-bg)', text: 'var(--vl-info-text)' },
  warn: { border: 'var(--vl-warn-border)', bg: 'var(--vl-warn-bg)', text: 'var(--vl-warn-text)' },
  success: {
    border: 'var(--vl-success-border)',
    bg: 'var(--vl-success-bg)',
    text: 'var(--vl-success-text)',
  },
}

const variantIcon: Record<CalloutProps['variant'], string> = {
  info: 'i',
  warn: '!',
  success: '✓',
}

export default function Callout({
  variant,
  text,
  description,
}: CalloutProps & { description?: string }) {
  const hover = useHover(description ? { title: 'Note', body: description } : null)
  const v = variantVars[variant]
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-6 py-4 text-xl"
      style={{ borderColor: v.border, backgroundColor: v.bg, color: v.text }}
      {...hover}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ backgroundColor: 'var(--vl-accent-soft)' }}
      >
        {variantIcon[variant]}
      </span>
      <span>{text}</span>
    </div>
  )
}
