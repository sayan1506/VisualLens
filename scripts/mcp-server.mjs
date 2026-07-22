// VisualLens MCP server.
// Two tools turn host-LLM output into a folder of slide PNGs:
//  - render_algorithm_deck: the LLM hand-authors the deck JSON (values traced by
//    the model — simplest, but can drift on hard problems).
//  - render_algorithm_from_code: the LLM writes an instrumented JS solution; the
//    server RUNS it in a sandbox so every value is computed by the real engine,
//    then assembles the deck. Preferred for correctness.
// Structural shape is enforced by the Zod inputSchema; semantic/bounds checks +
// friendly repair errors come from validateDeck(). stdout is the MCP channel —
// everything human-facing goes to stderr.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { validateDeck } from './lib/validate.mjs'
import { renderDeckToPngs } from './lib/render.mjs'
import { runInstrumentedCode } from './lib/runner.mjs'
import { buildDeckFromSteps } from './lib/buildDeck.mjs'
import schema from '../src/schema/limits.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const textError = (text) => ({ isError: true, content: [{ type: 'text', text }] })

function slugify(s) {
  return (
    (s || 'deck')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'deck'
  )
}

// Validate a fully-assembled deck, render it, and format the tool result.
// Shared by both tools so the render/return path is identical.
async function validateRenderReturn(deck, retryToolName) {
  if (!deck.meta.canvas) deck.meta.canvas = { width: 1280, height: 720 }

  const { valid, errors } = validateDeck(deck)
  if (!valid) {
    return textError(
      `Deck validation failed. Fix these and call ${retryToolName} again:\n` +
        errors.map((e) => `- ${e}`).join('\n'),
    )
  }

  const slug = slugify(deck.meta.problem_id || deck.meta.title)
  const outDir = resolve(root, 'out', slug)
  try {
    const paths = await renderDeckToPngs(deck, outDir)
    return {
      content: [
        {
          type: 'text',
          text:
            `Rendered ${paths.length} slide(s) for "${deck.meta.title}".\n` +
            `Output folder: ${outDir}\n` +
            paths.map((p, i) => `  slide ${String(i + 1).padStart(2, '0')}: ${p}`).join('\n') +
            `\n\nView it interactively (playback + keyboard nav): run \`npm run play ${slug}\` in the VisualLens repo.`,
        },
      ],
    }
  } catch (e) {
    return textError(
      `Render failed: ${e.message}\n(If this says dist/ is missing, run \`npm run build\` in the VisualLens repo.)`,
    )
  }
}

// ---- input schema (structural; bounds live in validateDeck) ----
const pointer = z.object({
  label: z.string(),
  index: z.number().int(),
  color: z.enum(schema.colors),
})
// id + description are optional on any component. They MUST be listed here:
// z.object strips unknown keys by default, so omitting them would silently drop
// a scene component's id (breaking patching) before validateDeck ever sees it.
const component = z.object({
  id: z.string().optional(),
  type: z.enum(schema.componentTypes),
  description: z.string().optional(),
  props: z.record(z.any()),
})
const slide = z.object({
  id: z.string(),
  template: z.enum(schema.templates),
  components: z.array(component).min(1),
  narration: z.string().optional(),
})
const step = z.object({
  id: z.string(),
  caption: z.string().optional(),
  variant: z.enum(schema.calloutVariants).optional(),
  patch: z.record(z.record(z.any())).optional(),
  narration: z.string().optional(),
})
const scene = z.object({
  id: z.string(),
  template: z.enum(schema.templates),
  label: z.string().optional(),
  components: z.array(component).min(1),
  steps: z.array(step).min(1),
})
const deckSchema = z
  .object({
    meta: z.object({
      problem_id: z.string().optional(),
      title: z.string(),
      canvas: z.object({ width: z.number(), height: z.number() }).optional(),
      difficulty: z.enum(schema.difficulties).optional(),
      complexity: z.object({ time: z.string().optional(), space: z.string().optional() }).optional(),
    }),
    slides: z.array(slide).min(1).optional(),
    scenes: z.array(scene).min(1).optional(),
  })
  .refine((d) => (d.slides && d.slides.length) || (d.scenes && d.scenes.length), {
    message: 'deck must have a non-empty slides array or scenes array',
  })

const AUTHORING_GUIDE = `Render a step-by-step algorithm explainer as a slide deck. Returns one PNG per slide.

Build a deck object: { meta:{ title, problem_id?, canvas?{width,height} }, slides:[...] }.
Default canvas is 1280x720 — omit unless you need another size.

Each slide: { id, template, components:[{type, props}], narration? }. Leave narration "" (reserved).

TEMPLATES (layout):
- "title"       — one title_block, centered. Use for the opening slide.
- "concept"     — stacked text/callout, no concrete data. Explain the idea.
- "array_state" — array_block + state_panel + callout, centered. The workhorse for stepping through an array.
- "code_walk"   — two columns: put a code_panel and an array_block side by side.

COMPONENTS (type → props):
- title_block  { title (<=60 chars), subtitle? (<=100) }
- text         { text (<=240), size?: "sm"|"md"|"lg", align?: "left"|"center" }
- callout      { variant: "info"|"warn"|"success", text (<=160) }  // one short takeaway per step
- array_block  { values: (number|string)[] (<=12), highlighted?: number[], pointers?: [{label,index,color}] (<=4), label?, notes?: (string|null)[] }
- code_panel   { lines: string[] (<=14), activeLine?: number (0-indexed), title? }
- state_panel  { vars: { name: value }, title? }
- tree         { nodes: (number|string|null)[] (<=31), highlighted?: number[], pointers?: [{label,index,color}] (<=4), label?, notes?: (string|null)[] }
    // A binary tree as a LeetCode-style LEVEL-ORDER array: index 0 is the root, node i's children are 2i+1 and 2i+2, null = missing node. Layout is automatic — never supply coordinates. highlighted/pointers use these level-order indices; never reference a null slot.
- graph        { nodes: [{id, x, y, value?}] (<=12), edges?: [{from, to, directed?, weight?}] (<=24), highlighted?: string[], pointers?: [{label, node, color}] (<=4), label?, notes?: {id: text} }
    // A general graph. x/y are NORMALIZED positions in 0..1 (0,0 = top-left) that YOU choose to lay it out. edges reference node ids. Unlike array/tree, highlighted + pointers reference node IDS (a graph has no index order).
  colors: "orange" | "blue" | "green" | "red". array/tree indices are 0-based and must be in bounds; graph highlighted/pointers/edges must reference known node ids.
  Pick ONE structure per walkthrough: array_state stacks it with a state_panel; code_walk puts a code_panel beside it.

OPTIONAL hover text (all interactive-only; never affects PNGs):
- Any component may carry a top-level "description" (<=200 chars): { type, description?, props }. Shown on hover/tap/focus.
- array_block "notes" (in props) is parallel to values: notes[i] is box i's hover text (null to skip). notes.length <= values.length.

SCENES (recommended for array walkthroughs — "same boxes, values change"):
Instead of repeating near-identical array_state slides, define the components ONCE and patch per step:
  { meta, slides:[<title/concept slides>], scenes:[ { id, template:"array_state",
      components:[ {id:"arr", type:"array_block", description?, props:{values,...}}, {id:"st", type:"state_panel", props:{vars:{}}} ],
      steps:[ { id, caption?(<=160), variant?, patch:{ arr:{highlighted:[..]}, st:{vars:{..}} } }, ... ] } ] }
- Every scene component needs a unique "id". A step's patch keys are those ids; each patch shallow-merges prop overrides.
- Patches are CUMULATIVE: a value set one step persists until another step overrides it — patch only what changed. To clear a highlight, patch highlighted:[] explicitly.
- Scenes flatten to one PNG per step automatically. Use slides for title/concept framing, a scene for the array walkthrough.

HOW TO BUILD A GOOD DECK:
1. Slide 1: title. Slide 2: concept (the intuition). Then a scene stepping through the array (or one array_state slide per step).
2. Show TWO approaches when relevant: brute force first, then optimal.
3. Every concrete value (sum, pointer positions, state vars) must be ACTUALLY CORRECT — trace the
   algorithm by hand or in code before emitting. Do not guess intermediate states.
4. Keep each caption/callout to a single clear sentence about what changed this step.
5. Prefer 6-15 steps. Hard cap 40 slides total (scene steps count as slides once flattened).

If the tool returns a validation error, fix exactly the listed problems and call it again.`

const server = new McpServer({ name: 'visuallens', version: '0.1.0' })

server.registerTool(
  'render_algorithm_deck',
  {
    title: 'Render algorithm deck',
    description: AUTHORING_GUIDE,
    inputSchema: { deck: deckSchema },
  },
  async ({ deck }) => validateRenderReturn(deck, 'render_algorithm_deck'),
)

// ---- code-execution tool: values computed by the real engine ----
const CODE_GUIDE = `Render a step-by-step algorithm explainer whose values are GUARANTEED CORRECT because the server executes your code.

You write a short synchronous JavaScript solution. It reads the problem input from the global \`input\` and calls the global \`record(step)\` at each meaningful step. The server runs it in a sandbox and turns each recorded step into a slide. This is preferred over render_algorithm_deck whenever the problem operates on an array — you never hand-compute intermediate values, so they can't be wrong.

INPUTS you provide:
- title (<=60), subtitle? (<=100), problem_id?
- intro? — one sentence explaining the idea (becomes a concept slide)
- outro? — closing note, e.g. complexity (becomes a final slide)
- input — a JSON object your code reads, e.g. { "nums": [1,3,5,7,9,11], "target": 7 }
- code — JavaScript (no imports, no async). Available globals: \`input\`, \`record\`.
- code_display? — string[] (<=14): the CLEAN source lines to SHOW beside the array (NOT your instrumented \`code\`; drop the record() calls, keep the algorithm). Provide this and the walkthrough gains a persistent code panel; then pass \`line\` in each record() to highlight the running line. Omit for no code panel.

record(step) — call once per step you want to show. Shape (all fields optional but include what's relevant).
Visualize ONE structure per run — an array, a tree, OR a graph:
  {
    // --- ARRAY (the default structure) ---
    values:      number[]|string[]   // the array being visualized (<=12). Send once; carried forward if omitted next step.
    highlighted: number[]            // indices to emphasize this step (ALSO used for tree)
    pointers:    [{ label, index, color? }]  // <=4; color auto-assigned per label if omitted (ALSO used for tree)
    notes:       (string|null)[]     // OPTIONAL per-box hover text, parallel to values/tree. Omit — auto-generated.

    // --- TREE (binary tree as a LeetCode-style level-order array) ---
    tree:        (number|string|null)[]  // <=31. index 0 = root, children of i at 2i+1/2i+2, null = missing node.
                                          // Reuses highlighted/pointers/notes above (SAME level-order indices; never a null slot).

    // --- GRAPH (id-based, so it has its OWN highlight/pointer/notes fields) ---
    graph:            { nodes:[{id,x,y,value?}], edges?:[{from,to,directed?,weight?}] }  // x,y normalized 0..1; <=12 nodes, <=24 edges
    graphHighlighted: string[]                    // node ids to emphasize
    graphPointers:    [{ label, node, color? }]   // <=4; node is a node id
    graphNotes:       { id: text }                // OPTIONAL per-node hover text keyed by id

    // --- shared across all structures ---
    state:       { name: value }     // scalar variables to show (numbers/strings/bools)
    explanation: string              // one sentence describing this step (<=160)
    variant:     "info"|"warn"|"success"  // callout style; default info, use success for the final step
    line:        number              // 0-based index into code_display to highlight this step (only if you passed code_display)
    descriptions:{ array?, tree?, graph?, state?, code? }  // OPTIONAL hover text for the panels (<=200 each). Omit — defaults added.
  }
  Array/tree indices are 0-based and in bounds; graph fields reference known node ids; line is within code_display.length.

INTERACTIVITY (automatic): array runs are rendered as a persistent "scoreboard" —
the same boxes/panels stay on screen and only their values change between steps,
and every element shows a hover/tap description. You get this for free; the
descriptions/notes fields above only let you OVERRIDE the defaults. Static PNGs
look the same as before; hover text is interactive-only.

EXAMPLE (binary search, with a code panel):
  input: { "nums": [1,3,5,7,9,11], "target": 7 }
  code_display: [
    "lo = 0, hi = n - 1",              // line 0
    "while lo <= hi:",                 // line 1
    "  mid = (lo + hi) // 2",          // line 2
    "  if nums[mid] == target: return mid",   // line 3
    "  elif nums[mid] < target: lo = mid + 1", // line 4
    "  else: hi = mid - 1"             // line 5
  ]
  code:
    const { nums, target } = input;
    let lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const found = nums[mid] === target;
      record({
        values: nums, highlighted: [mid],
        pointers: [{label:'lo',index:lo},{label:'mid',index:mid},{label:'hi',index:hi}],
        state: { lo, hi, mid, 'nums[mid]': nums[mid], target },
        line: found ? 3 : nums[mid] < target ? 4 : 5,  // highlight the branch that runs
        explanation: found ? \`nums[\${mid}] = \${target}. Found it.\`
                    : nums[mid] < target ? \`nums[\${mid}] < \${target}, search right.\`
                    : \`nums[\${mid}] > \${target}, search left.\`,
        variant: found ? 'success' : 'info'
      });
      if (found) break;
      else if (nums[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }

EXAMPLE (in-place sort — record BEFORE you mutate):
  input: { "nums": [5, 2, 4, 1] }
  code_display: [
    "for i in 0..n-1:",              // line 0
    "  for j in 0..n-1-i:",          // line 1
    "    if nums[j] > nums[j+1]:",   // line 2
    "      swap(nums[j], nums[j+1])" // line 3
  ]
  code:
    const { nums } = input;
    const n = nums.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1 - i; j++) {
        const willSwap = nums[j] > nums[j + 1];
        record({                              // record the DECISION first, while
          values: nums,                       // nums still shows the pre-swap order
          highlighted: [j, j + 1],
          state: { i, j, 'nums[j]': nums[j], 'nums[j+1]': nums[j + 1] },
          line: willSwap ? 3 : 2,
          explanation: willSwap ? 'nums[' + j + '] > nums[' + (j + 1) + '], swap them.'
                                : 'nums[' + j + '] <= nums[' + (j + 1) + '], keep order.'
        });
        if (willSwap) { const t = nums[j]; nums[j] = nums[j + 1]; nums[j + 1] = t; }
      }
    }
    record({ values: nums, explanation: 'Array is fully sorted.', variant: 'success' }); // final frame shows the RESULT
  Each swap's result appears on the NEXT frame; the final record() after the loop shows the last swap's effect and the sorted array.

RULES:
- record() BEFORE you mutate. For in-place algorithms (swaps, in-place writes), snapshot the step at the TOP of the iteration — before the swap/assignment — so the array, pointers, state, and caption all describe the SAME instant, and the change shows up on the next frame. Recording AFTER a swap produces a frame whose array is already updated but whose caption/state still describe the old values (a self-contradicting slide).
- Add ONE final record() after the loop for in-place algorithms. Because each step is captured before its mutation, the LAST mutation has no following frame — without a terminal record() the deck ends on the pre-final-swap array (e.g. a sort that looks unfinished). The final record() shows the completed result.
- Keep it synchronous and finite. Execution is time-limited; infinite loops are killed.
- Call record() at least once, at most ~34 times (extra steps are dropped).
- Do not print — only record() produces output.
If the tool returns an error, fix your code or inputs and call it again.`

const codeInputSchema = {
  title: z.string(),
  subtitle: z.string().optional(),
  problem_id: z.string().optional(),
  intro: z.string().optional(),
  outro: z.string().optional(),
  input: z.record(z.any()).optional(),
  code: z.string(),
  code_display: z.array(z.string()).optional(),
}

server.registerTool(
  'render_algorithm_from_code',
  {
    title: 'Render algorithm from code (values computed, guaranteed correct)',
    description: CODE_GUIDE,
    inputSchema: codeInputSchema,
  },
  async ({ title, subtitle, problem_id, intro, outro, input, code, code_display }) => {
    const result = await runInstrumentedCode(code, input || {}, { timeoutMs: 2000, maxSteps: 40 })

    if (!result.ok) {
      return textError(
        `Your code failed to run: ${result.error}\n` +
          `Fix the code and call render_algorithm_from_code again. ` +
          `Remember: synchronous only, read from the global \`input\`, call \`record({...})\` per step.`,
      )
    }
    if (!result.steps || result.steps.length === 0) {
      return textError(
        `Your code ran but never called record(). Add record({ values, pointers, state, explanation }) ` +
          `at each step you want to visualize, then call render_algorithm_from_code again.`,
      )
    }

    // Seed carry-forward from the first step that supplied values.
    const firstWithValues = result.steps.find((s) => Array.isArray(s.values))
    const deck = buildDeckFromSteps({
      title,
      subtitle,
      problemId: problem_id,
      intro,
      outro,
      steps: result.steps,
      initialValues: firstWithValues ? firstWithValues.values : null,
      codeDisplay: code_display,
    })

    const res = await validateRenderReturn(deck, 'render_algorithm_from_code')
    if (!res.isError && result.overflow) {
      res.content[0].text += `\n\nNote: step recording was capped, so only the first ${result.steps.length} steps were shown.`
    }
    return res
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('visuallens MCP server running on stdio (tools: render_algorithm_deck, render_algorithm_from_code)')
