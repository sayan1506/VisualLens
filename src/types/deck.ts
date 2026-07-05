// The contract between the host LLM and the VisualLens renderer.
// Every deck the LLM emits must conform to these types. Enum TYPES are
// hand-written here; their runtime VALUES + authoring limits come from
// src/schema/limits.json (the cross-language source of truth — see LIMITS).

import schema from '../schema/limits.json'

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
  notes?: (string | null)[] // per-box hover text, parallel to values; null/absent → default
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
// Every instance may also carry (additive, backward-compatible):
//   id          — stable identity. REQUIRED inside a Scene so the renderer can
//                 key by it and patch values in place; ignored in legacy Slides.
//   description — hover/tap "what is this component" text (distinct from the
//                 per-slide `narration` TTS field).

type WithMeta<T> = T & { id?: string; description?: string }

export type ComponentInstance = WithMeta<
  | { type: 'title_block'; props: TitleBlockProps }
  | { type: 'text'; props: TextProps }
  | { type: 'callout'; props: CalloutProps }
  | { type: 'array_block'; props: ArrayBlockProps }
  | { type: 'code_panel'; props: CodePanelProps }
  | { type: 'state_panel'; props: StatePanelProps }
>

export type ComponentType = ComponentInstance['type']

// ---- slide + deck ----

export interface Slide {
  id: string
  template: TemplateId
  components: ComponentInstance[]
  narration?: string // dormant — reserved for future TTS
}

// ---- scene + steps (scoreboard authoring) ----
// A Scene declares its components ONCE (persistent tree); each Step patches
// prop overrides onto them by component id. This is the non-repetitive,
// "same boxes the whole time, only values change" model. Scenes normalize to
// Slide[] (one per step) for the PNG pipeline — see scripts/lib/normalizeDeck.

export interface Step {
  id: string
  caption?: string // per-step explanation (rendered as a trailing callout when flattened)
  variant?: 'info' | 'warn' | 'success' // caption styling
  patch?: Record<string, Record<string, unknown>> // componentId → shallow-merged prop overrides
  narration?: string // dormant — reserved for future TTS
}

export interface Scene {
  id: string
  template: TemplateId
  components: ComponentInstance[] // persistent tree; each component MUST have an id; props = initial state
  steps: Step[] // >= 1
}

export interface DeckMeta {
  problem_id: string
  title: string
  canvas: { width: number; height: number }
}

export interface Deck {
  meta: DeckMeta
  slides?: Slide[] // optional; derived from scenes by normalizeDeck when absent
  scenes?: Scene[] // when present, the Player renders these as persistent (scoreboard) trees
}

// ---- authoring limits + enum lists ----
// Single source of truth lives in src/schema/limits.json so the .mjs validator,
// build script, and MCP server can import the SAME values (they can't import
// this .ts file). The TS enum TYPES above stay hand-written (types are
// compile-time); only the runtime VALUES come from JSON.

export const LIMITS = schema
export const DEFAULT_CANVAS = schema.defaultCanvas
