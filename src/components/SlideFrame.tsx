import type { ReactNode } from 'react'
import { DEFAULT_CANVAS } from '../types/deck'

interface SlideFrameProps {
  width?: number
  height?: number
  children: ReactNode
}

// Fixed-canvas wrapper. Every slide renders inside exactly one of these at the
// deck's canvas size, so the Playwright screenshot is pixel-deterministic.
export default function SlideFrame({
  width = DEFAULT_CANVAS.width,
  height = DEFAULT_CANVAS.height,
  children,
}: SlideFrameProps) {
  return (
    <div
      data-slide-frame
      className="relative overflow-hidden bg-slate-900 text-slate-100"
      style={{ width, height }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
      <div className="relative h-full w-full px-16 py-12">{children}</div>
    </div>
  )
}
