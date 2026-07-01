import type { ComponentInstance, Slide } from '../types/deck'
import SlideFrame from '../components/SlideFrame'
import TitleBlock from '../components/TitleBlock'
import Text from '../components/Text'
import Callout from '../components/Callout'
import ArrayBlock from '../components/ArrayBlock'
import CodePanel from '../components/CodePanel'
import StatePanel from '../components/StatePanel'
import { TemplateLayout } from './templates'

function renderComponent(c: ComponentInstance, key: number) {
  switch (c.type) {
    case 'title_block':
      return <TitleBlock key={key} {...c.props} />
    case 'text':
      return <Text key={key} {...c.props} />
    case 'callout':
      return <Callout key={key} {...c.props} />
    case 'array_block':
      return <ArrayBlock key={key} {...c.props} />
    case 'code_panel':
      return <CodePanel key={key} {...c.props} />
    case 'state_panel':
      return <StatePanel key={key} {...c.props} />
  }
}

interface SlideRendererProps {
  slide: Slide
  width?: number
  height?: number
}

export default function SlideRenderer({ slide, width, height }: SlideRendererProps) {
  return (
    <SlideFrame width={width} height={height}>
      <TemplateLayout template={slide.template}>
        {slide.components.map((c, i) => renderComponent(c, i))}
      </TemplateLayout>
    </SlideFrame>
  )
}
