// The contract between the host LLM and the VisualLens renderer.
// Every deck the LLM emits must conform to these types. Enum TYPES are
// hand-written here; their runtime VALUES + authoring limits come from
// src/schema/limits.json (the cross-language source of truth — see LIMITS).

import schema from '../schema/limits.json'

export type ColorName = 'orange' | 'blue' | 'green' | 'red'

export type TemplateId = 'title' | 'concept' | 'array_state' | 'code_walk'

export type Difficulty = 'easy' | 'medium' | 'hard'

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
  colors?: (ColorName | null)[] // per-box fill tint, parallel to values (Dutch-flag / bucket coloring); null → default
}

// A histogram / bar chart. Bar height is proportional to its numeric value.
// Shares the array pointer model (labeled carets that glide between columns).
// `overlay` shades the span [from..to] as a filled region (e.g. the water a
// container holds); `maxLine` draws a horizontal reference line at a value
// (e.g. the running best area / max height seen so far).
export interface BarChartProps {
  values: number[]
  highlighted?: number[]
  pointers?: Pointer[]
  label?: string
  notes?: (string | null)[]
  overlay?: { from: number; to: number; label?: string }
  maxLine?: { value: number; label?: string }
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

// A binary tree given as a LeetCode-style level-order array: index 0 is the
// root, node i's children are at 2i+1 and 2i+2, and `null` marks a missing
// node (so its subtree slots are skipped in layout). Positions are computed by
// the component — authors only supply the array. highlighted/pointers reference
// the SAME level-order indices, so a null slot must not be highlighted.
export interface TreeProps {
  nodes: (number | string | null)[]
  highlighted?: number[]
  pointers?: Pointer[] // pointer.index is a level-order node index
  label?: string
  notes?: (string | null)[] // per-node hover text, parallel to nodes
}

// A general graph with author-supplied node positions in normalized [0,1]
// space (0,0 = top-left of the plotting area). Edges reference node ids.
// highlighted/pointers reference node ids (NOT array indices, unlike tree/array)
// because a graph has no natural ordering.
export interface GraphNode {
  id: string
  x: number // 0..1, normalized horizontal position
  y: number // 0..1, normalized vertical position
  value?: number | string // label drawn inside the node; defaults to id
}

export interface GraphEdge {
  from: string
  to: string
  directed?: boolean
  weight?: number | string
}

export interface GraphPointer {
  label: string
  node: string // node id this pointer sits on
  color: ColorName
}

export interface GraphProps {
  nodes: GraphNode[]
  edges?: GraphEdge[]
  highlighted?: string[] // node ids to emphasize
  pointers?: GraphPointer[]
  label?: string
  notes?: Record<string, string> // node id → hover text
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
  | { type: 'tree'; props: TreeProps }
  | { type: 'graph'; props: GraphProps }
  | { type: 'bar_chart'; props: BarChartProps }
>

export type ComponentType = ComponentInstance['type']

// ---- slide + deck ----

export interface Slide {
  id: string
  template: TemplateId
  components: ComponentInstance[]
  narration?: string // dormant — reserved for future TTS
  // Stamped by flattenScene (not authored): which scene/approach this step-slide
  // came from. Lets the Player group step-slides into approach tabs and lets the
  // header band show the active approach label. Absent on leading framing slides.
  sceneId?: string
  approachLabel?: string
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
  label?: string // approach name shown in the Player's approach tabs (e.g. "Brute force", "Two pointers")
  components: ComponentInstance[] // persistent tree; each component MUST have an id; props = initial state
  steps: Step[] // >= 1
}

export interface DeckMeta {
  problem_id: string
  title: string
  canvas: { width: number; height: number }
  difficulty?: Difficulty // optional framing chip in the header band
  complexity?: { time?: string; space?: string } // optional Big-O chips, e.g. { time: "O(n)", space: "O(1)" }
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
