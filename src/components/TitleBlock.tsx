import type { TitleBlockProps } from '../types/deck'
import { useHover } from './HoverContext'

export default function TitleBlock({
  title,
  subtitle,
  description,
}: TitleBlockProps & { description?: string }) {
  const hover = useHover(description ? { title: 'Title', body: description } : null)
  return (
    <div className="text-center" {...hover}>
      <h1 className="text-5xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="mt-4 text-xl text-slate-400">{subtitle}</p>}
    </div>
  )
}
