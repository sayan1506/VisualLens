import type { TextProps } from '../types/deck'
import { useHover } from './HoverContext'

const sizeClass: Record<NonNullable<TextProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
}

export default function Text({
  text,
  size = 'md',
  align = 'left',
  description,
}: TextProps & { description?: string }) {
  const hover = useHover(description ? { title: 'Text', body: description } : null)
  return (
    <p
      className={`${sizeClass[size]} leading-relaxed text-slate-200 ${
        align === 'center' ? 'text-center' : 'text-left'
      }`}
      {...hover}
    >
      {text}
    </p>
  )
}
