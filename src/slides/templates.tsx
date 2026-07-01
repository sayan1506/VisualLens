import type { ReactNode } from 'react'
import type { TemplateId } from '../types/deck'

// A template is just a layout container; components render in JSON order inside it.
const layoutClass: Record<TemplateId, string> = {
  title: 'h-full flex flex-col items-center justify-center gap-6',
  concept: 'h-full flex flex-col justify-center gap-8',
  array_state: 'h-full flex flex-col items-center justify-center gap-10',
  code_walk: 'h-full grid grid-cols-2 gap-10 items-start content-center',
}

export function TemplateLayout({
  template,
  children,
}: {
  template: TemplateId
  children: ReactNode
}) {
  return <div className={layoutClass[template]}>{children}</div>
}
