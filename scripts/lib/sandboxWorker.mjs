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
  if (step.descriptions && typeof step.descriptions === 'object') {
    const d = {}
    for (const k of ['array', 'state', 'code', 'tree', 'graph']) {
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
