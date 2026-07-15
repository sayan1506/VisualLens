import type { ComponentInstance } from '../types/deck'
import TitleBlock from '../components/TitleBlock'
import Text from '../components/Text'
import Callout from '../components/Callout'
import ArrayBlock from '../components/ArrayBlock'
import CodePanel from '../components/CodePanel'
import StatePanel from '../components/StatePanel'
import Tree from '../components/Tree'
import Graph from '../components/Graph'
import BarChart from '../components/BarChart'

// Single per-type dispatch, shared by SlideRenderer (order-based framing
// templates) and ScoreboardLayout (role-partitioned zoned templates).
//
// `id` and `description` live on the component INSTANCE, not in `props`, so they
// are passed explicitly (the {...c.props} spread would miss them). The React key
// is the stable `id` when present — this is what makes the scoreboard work:
// stepping between a scene's flattened slides reconciles same-id nodes and
// patches their values in place instead of remounting.
export function renderComponent(c: ComponentInstance, key: string | number) {
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
    case 'tree':
      return <Tree key={key} description={description} {...c.props} />
    case 'graph':
      return <Graph key={key} description={description} {...c.props} />
    case 'bar_chart':
      return <BarChart key={key} description={description} {...c.props} />
  }
}
