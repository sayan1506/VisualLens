// The contract between the host LLM and the VisualLens renderer.
// Every deck the LLM emits must conform to these types. Keep this file the
// single source of truth — the MCP input schema (Phase 3) is derived from it.

export type ColorName = 'orange' | 'blue' | 'green' | 'red'

export type TemplateId = 'title' | 'concept' | 'array_state' | 'code_walk'

export interface Pointer {
  label: string
  index: number
  color: ColorName
}

// ---- component prop types ----

export interface TitleBlockProps {
  title: string
  subtitle?: string
}

export interface TextProps {
  text: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'center'
}

export interface CalloutProps {
  variant: 'info' | 'warn' | 'success'
  text: string
}

export interface ArrayBlockProps {
  values: (number | string)[]
  highlighted?: number[]
  pointers?: Pointer[]
  label?: string
}

export interface CodePanelProps {
  lines: string[]
  activeLine?: number
  title?: string
}

export interface StatePanelProps {
  vars: Record<string, string | number | boolean>
  title?: string
}

// ---- component instance discriminated union ----
// `type` selects the component; `props` is that component's prop shape.

export type ComponentInstance =
  | { type: 'title_block'; props: TitleBlockProps }
  | { type: 'text'; props: TextProps }
  | { type: 'callout'; props: CalloutProps }
  | { type: 'array_block'; props: ArrayBlockProps }
  | { type: 'code_panel'; props: CodePanelProps }
  | { type: 'state_panel'; props: StatePanelProps }

export type ComponentType = ComponentInstance['type']

// ---- slide + deck ----

export interface Slide {
  id: string
  template: TemplateId
  components: ComponentInstance[]
  narration?: string // dormant — reserved for future TTS
}

export interface DeckMeta {
  problem_id: string
  title: string
  canvas: { width: number; height: number }
}

export interface Deck {
  meta: DeckMeta
  slides: Slide[]
}

// ---- authoring limits (enforced by the validator in Phase 3) ----
// Centralized so the renderer, validator, and LLM authoring guide agree.

export const LIMITS = {
  maxSlides: 40,
  maxTitleChars: 60,
  maxSubtitleChars: 100,
  maxTextChars: 240,
  maxCalloutChars: 160,
  maxArrayValues: 12,
  maxCodeLines: 14,
  maxPointers: 4,
} as const

export const DEFAULT_CANVAS = { width: 1280, height: 720 } as const
