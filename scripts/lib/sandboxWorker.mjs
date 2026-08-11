// Runs untrusted, instrumented algorithm code inside a fresh vm context.
// Executes in a worker thread so the parent can hard-terminate runaways and so
// a crash can't take down the MCP server. The vm context has standard JS
// built-ins but NO require/process/fs/network/timers — pure synchronous compute.
//
// NOTE: node:vm is not a hardened security boundary. That is acceptable here:
// the code is written by the user's own LLM, for the user's own request, on the
// user's own machine (local server). A remote deployment would need isolated-vm.
import { workerData, parentPort } from 'node:worker_threads'
import vm from 'node:vm'

const { code, input, limits } = workerData
const maxSteps = limits?.maxSteps ?? 60
const timeoutMs = limits?.timeoutMs ?? 2000

const steps = []
let overflow = false

const COLORS = ['orange', 'blue', 'green', 'red']

// Snapshot a step at record() time — deep-ish copy so later mutation of the
// caller's arrays/objects can't corrupt already-recorded steps.
function sanitizeStep(step) {
  if (!step || typeof step !== 'object') return { explanation: String(step ?? '') }
  const out = {}
  if (Array.isArray(step.values)) out.values = step.values.slice()
  if (Array.isArray(step.highlighted)) {
    out.highlighted = step.highlighted.filter((h) => Number.isInteger(h))
  }
  if (Array.isArray(step.pointers)) {
    out.pointers = step.pointers
      .filter((p) => p && p.label != null && Number.isFinite(Number(p.index)))
      .map((p) => ({
        label: String(p.label),
        index: Number(p.index),
        color: COLORS.includes(p.color) ? p.color : undefined,
      }))
  }
  if (step.state && typeof step.state === 'object') {
    const s = {}
    for (const [k, v] of Object.entries(step.state)) {
      if (v === null || ['number', 'string', 'boolean'].includes(typeof v)) s[k] = v
    }
    out.state = s
  }
  if (step.explanation !== undefined) out.explanation = String(step.explanation)
  if (['info', 'warn', 'success'].includes(step.variant)) out.variant = step.variant
  // Optional: active code line (0-indexed into code_display) for the code panel.
  if (Number.isInteger(step.line)) out.line = step.line
  // Optional author overrides. Whitelisted here so they actually reach buildDeck
  // — anything not copied out is dropped, which previously silently swallowed these.
  if (Array.isArray(step.notes)) out.notes = step.notes.map((n) => (n == null ? null : String(n)))
  if (Array.isArray(step.colors))
    out.colors = step.colors.map((c) => (COLORS.includes(c) ? c : null))
  if (step.descriptions && typeof step.descriptions === 'object') {
    const d = {}
    for (const k of ['array', 'state', 'code', 'tree', 'graph', 'grid', 'list']) {
      if (typeof step.descriptions[k] === 'string') d[k] = step.descriptions[k]
    }
    if (Object.keys(d).length) out.descriptions = d
  }

  // ---- tree: a LeetCode-style level-order array. highlighted/pointers/notes
  // above are reused with the SAME integer-index semantics as an array run, so
  // only the node array is tree-specific here. null marks a missing node. ----
  if (Array.isArray(step.tree)) {
    out.tree = step.tree.map((v) => (v === null || ['number', 'string'].includes(typeof v) ? v : String(v)))
  }

  // ---- graph: nodes with normalized [0,1] positions + edges by id. Highlight,
  // pointers, and notes are ID-based (distinct from the index-based array/tree
  // fields), so they get their own graph* fields. ----
  if (step.graph && typeof step.graph === 'object' && Array.isArray(step.graph.nodes)) {
    const nodes = step.graph.nodes
      .filter((n) => n && n.id != null && Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y)))
      .map((n) => ({
        id: String(n.id),
        x: Number(n.x),
        y: Number(n.y),
        ...(['number', 'string'].includes(typeof n.value) ? { value: n.value } : {}),
      }))
    const edges = Array.isArray(step.graph.edges)
      ? step.graph.edges
          .filter((e) => e && e.from != null && e.to != null)
          .map((e) => ({
            from: String(e.from),
            to: String(e.to),
            ...(e.directed ? { directed: true } : {}),
            ...(['number', 'string'].includes(typeof e.weight) ? { weight: e.weight } : {}),
          }))
      : []
    out.graph = { nodes, edges }
  }
  if (Array.isArray(step.graphHighlighted)) {
    out.graphHighlighted = step.graphHighlighted.filter((h) => typeof h === 'string')
  }
  if (Array.isArray(step.graphPointers)) {
    out.graphPointers = step.graphPointers
      .filter((p) => p && p.label != null && p.node != null)
      .map((p) => ({
        label: String(p.label),
        node: String(p.node),
        color: COLORS.includes(p.color) ? p.color : undefined,
      }))
  }
  if (step.graphNotes && typeof step.graphNotes === 'object' && !Array.isArray(step.graphNotes)) {
    const gn = {}
    for (const [k, v] of Object.entries(step.graphNotes)) if (typeof v === 'string') gn[k] = v
    out.graphNotes = gn
  }

  // ---- grid: a row-major 2D matrix. Cells are {row,col}-addressed (distinct
  // from the index-based array/tree and id-based graph fields), so highlight,
  // pointers, colors, and notes all get their own grid* fields. null = a blocked
  // / not-yet-filled cell. ----
  if (Array.isArray(step.grid) && step.grid.every((row) => Array.isArray(row))) {
    out.grid = step.grid.map((row) =>
      row.map((v) => (v === null || ['number', 'string'].includes(typeof v) ? v : String(v))),
    )
  }
  if (Array.isArray(step.gridHighlighted)) {
    out.gridHighlighted = step.gridHighlighted
      .filter((h) => h && Number.isInteger(h.row) && Number.isInteger(h.col))
      .map((h) => ({ row: h.row, col: h.col }))
  }
  if (Array.isArray(step.gridPointers)) {
    out.gridPointers = step.gridPointers
      .filter((p) => p && p.label != null && Number.isInteger(p.row) && Number.isInteger(p.col))
      .map((p) => ({
        label: String(p.label),
        row: p.row,
        col: p.col,
        color: COLORS.includes(p.color) ? p.color : undefined,
      }))
  }
  if (Array.isArray(step.gridColors)) {
    out.gridColors = step.gridColors.map((row) =>
      Array.isArray(row) ? row.map((c) => (COLORS.includes(c) ? c : null)) : [],
    )
  }
  if (Array.isArray(step.gridNotes)) {
    out.gridNotes = step.gridNotes.map((row) =>
      Array.isArray(row) ? row.map((nn) => (nn == null ? null : String(nn))) : [],
    )
  }
  // Axis labels are static for the whole run (DP-table headers), seeded once by
  // buildDeck rather than patched per step.
  if (Array.isArray(step.gridRowLabels)) out.gridRowLabels = step.gridRowLabels.map((l) => String(l))
  if (Array.isArray(step.gridColLabels)) out.gridColLabels = step.gridColLabels.map((l) => String(l))

  // ---- linked list: node values are index-addressed like an array, so it
  // REUSES the highlighted/pointers/notes fields above (same integer indices).
  // Only `list` (node values) and `listNext` (parallel successor-index array;
  // null = end) are list-specific. Omit listNext for the default forward chain. ----
  if (Array.isArray(step.list)) {
    out.list = step.list.map((v) => (['number', 'string'].includes(typeof v) ? v : String(v)))
  }
  if (Array.isArray(step.listNext)) {
    out.listNext = step.listNext.map((nx) => (Number.isInteger(nx) ? nx : null))
  }
  return out
}

function record(step) {
  if (steps.length >= maxSteps) {
    overflow = true
    return
  }
  steps.push(sanitizeStep(step))
}

const sandbox = {
  input,
  record,
  console: { log() {}, warn() {}, error() {} }, // fresh vm context has no console
}

try {
  const context = vm.createContext(sandbox)
  vm.runInContext(code, context, { timeout: timeoutMs, displayErrors: true })
  parentPort.postMessage({ ok: true, steps, overflow })
} catch (e) {
  parentPort.postMessage({ ok: false, error: e.message, steps, overflow })
}
