import type { TextProps } from '../types/deck'

const sizeClass: Record<NonNullable<TextProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
}

export default function Text({ text, size = 'md', align = 'left' }: TextProps) {
  return (
    <p
      className={`${sizeClass[size]} leading-relaxed text-slate-200 ${
        align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      {text}
    </p>
  )
}
