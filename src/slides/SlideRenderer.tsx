import type { ComponentInstance, Slide } from '../types/deck'
import SlideFrame from '../components/SlideFrame'
import TitleBlock from '../components/TitleBlock'
import Text from '../components/Text'
import Callout from '../components/Callout'
import ArrayBlock from '../components/ArrayBlock'
import CodePanel from '../components/CodePanel'
import StatePanel from '../components/StatePanel'
import { TemplateLayout } from './templates'

// `id` and `description` live on the component INSTANCE, not in `props`, so they
// are passed explicitly (the {...c.props} spread would miss them). The React key
// is the stable `id` when present — this is what makes the scoreboard work:
// stepping between a scene's flattened slides reconciles same-id nodes and
// patches their values in place instead of remounting.
function renderComponent(c: ComponentInstance, key: string | number) {
  const description = c.description
  switch (c.type) {
    case 'title_block':
      return <TitleBlock key={key} description={description} {...c.props} />
    case 'text':
      return <Text key={key} description={description} {...c.props} />
    case 'callout':
      return <Callout key={key} description={description} {...c.props} />
    case 'array_block':
      return <ArrayBlock key={key} description={description} {...c.props} />
    case 'code_panel':
      return <CodePanel key={key} description={description} {...c.props} />
    case 'state_panel':
      return <StatePanel key={key} description={description} {...c.props} />
  }
}

interface SlideRendererProps {
  slide: Slide
  width?: number
  height?: number
  theme?: 'dark' | 'light'
}

export default function SlideRenderer({ slide, width, height, theme }: SlideRendererProps) {
  return (
    <SlideFrame width={width} height={height} theme={theme}>
      <TemplateLayout template={slide.template}>
        {slide.components.map((c, i) => renderComponent(c, c.id ?? i))}
      </TemplateLayout>
    </SlideFrame>
  )
}
