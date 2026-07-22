import type { DeckMeta, Slide, TemplateId } from '../types/deck'
import SlideFrame from '../components/SlideFrame'
import ScoreboardLayout from './ScoreboardLayout'
import { renderComponent } from './renderComponent'
import { TemplateLayout } from './templates'

// Zoned (docked scoreboard) templates partition components by role; framing
// templates keep the centered, order-based TemplateLayout.
const ZONED: Record<TemplateId, boolean> = {
  title: false,
  concept: false,
  array_state: true,
  code_walk: true,
}

interface SlideRendererProps {
  slide: Slide
  width?: number
  height?: number
  theme?: 'dark' | 'light'
  deckMeta?: Pick<DeckMeta, 'title' | 'difficulty' | 'complexity'>
  stepIndex?: number
  stepTotal?: number
}

export default function SlideRenderer({
  slide,
  width,
  height,
  theme,
  deckMeta,
  stepIndex,
  stepTotal,
}: SlideRendererProps) {
  return (
    <SlideFrame width={width} height={height} theme={theme}>
      {ZONED[slide.template] ? (
        <ScoreboardLayout
          components={slide.components}
          deckMeta={deckMeta}
          approachLabel={slide.approachLabel}
          stepIndex={stepIndex}
          stepTotal={stepTotal}
        />
      ) : (
        <div className="h-full w-full px-16 py-12">
          <TemplateLayout template={slide.template}>
            {slide.components.map((c, i) => renderComponent(c, c.id ?? i))}
          </TemplateLayout>
        </div>
      )}
    </SlideFrame>
  )
}
