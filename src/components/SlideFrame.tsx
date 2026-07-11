import type { ReactNode } from 'react'
import { DEFAULT_CANVAS } from '../types/deck'

interface SlideFrameProps {
  width?: number
  height?: number
  theme?: 'dark' | 'light'
  children: ReactNode
}

// Fixed-canvas wrapper. Every slide renders inside exactly one of these at the
// deck's canvas size, so the Playwright screenshot is pixel-deterministic. It
// carries its own `data-theme` so a screenshot is self-contained (the PNG never
// depends on an ancestor outside the captured element).
export default function SlideFrame({
  width = DEFAULT_CANVAS.width,
  height = DEFAULT_CANVAS.height,
  theme = 'dark',
  children,
}: SlideFrameProps) {
  return (
    <div
      data-slide-frame
      data-theme={theme}
      className="relative overflow-hidden"
      style={{ width, height, background: 'var(--vl-bg)', color: 'var(--vl-text)' }}
    >
      <div className="absolute inset-0" style={{ background: 'var(--vl-bg-gradient)' }} />
      <div className="relative h-full w-full px-16 py-12">{children}</div>
    </div>
  )
}
