import type { CalloutProps } from '../types/deck'
import { useHover } from './HoverContext'

const variantStyle: Record<CalloutProps['variant'], string> = {
  info: 'border-sky-400/40 bg-sky-400/10 text-sky-100',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
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
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-6 py-4 text-xl ${variantStyle[variant]}`}
      {...hover}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
        {variantIcon[variant]}
      </span>
      <span>{text}</span>
    </div>
  )
}
