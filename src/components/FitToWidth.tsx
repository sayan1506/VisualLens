import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Scales its child down to fit the available zone, never upscaling past 1:1.
// This is what lets a full-width visualization (e.g. a 12-value array ≈ 996px)
// live in the narrower left zone of the docked layout without being clipped by
// the frame's `overflow-hidden`.
//
// It measures the CONTAINER (the zone it fills) and the CONTENT's natural
// layout size, then applies `transform: scale`. `transform` is paint-only and
// does not change layout box size, so `scrollWidth`/`clientWidth` stay stable
// regardless of the current scale — no measurement feedback loop. Runs in
// `useLayoutEffect` (before paint), so the PNG capture reads a settled scale.
export default function FitToWidth({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return
    const measure = () => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      const sw = content.scrollWidth
      const sh = content.scrollHeight
      if (sw === 0 || sh === 0 || cw === 0 || ch === 0) return
      const s = Math.min(1, cw / sw, ch / sh)
      setScale(s > 0 && Number.isFinite(s) ? s : 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        ref={contentRef}
        style={{ transform: `scale(${scale})`, transformOrigin: 'center center', flex: 'none' }}
      >
        {children}
      </div>
    </div>
  )
}
