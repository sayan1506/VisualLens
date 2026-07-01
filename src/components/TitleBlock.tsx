import type { TitleBlockProps } from '../types/deck'

export default function TitleBlock({ title, subtitle }: TitleBlockProps) {
  return (
    <div className="text-center">
      <h1 className="text-5xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="mt-4 text-xl text-slate-400">{subtitle}</p>}
    </div>
  )
}
