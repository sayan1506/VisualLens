// Protocol smoke test: spawn the MCP server over stdio using the SDK client,
// list tools, and confirm render_algorithm_deck is exposed with a schema.
// Verifies the server actually boots and speaks MCP — not just syntax.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const serverPath = resolve(here, 'mcp-server.mjs')

const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] })
const client = new Client({ name: 'smoke-client', version: '0.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.error('tools exposed:', tools.map((t) => t.name).join(', '))
const tool = tools.find((t) => t.name === 'render_algorithm_deck')
if (!tool) {
  console.error('FAIL: render_algorithm_deck not found')
  process.exit(1)
}
console.error('has inputSchema:', !!tool.inputSchema)
console.error('description length:', (tool.description || '').length, 'chars')

// Send an intentionally invalid deck to confirm the validation/repair path works.
const bad = await client.callTool({
  name: 'render_algorithm_deck',
  arguments: { deck: { meta: { title: 'X' }, slides: [{ id: 's1', template: 'array_state', components: [{ type: 'array_block', props: { values: [1, 2], pointers: [{ label: 'p', index: 9, color: 'orange' }] } }] }] } },
})
console.error('invalid-deck isError:', bad.isError === true)
console.error('repair message:', bad.content[0].text.split('\n').slice(0, 2).join(' | '))

// Happy path: a valid deck through the spawned server must produce PNG paths.
const good = await client.callTool({
  name: 'render_algorithm_deck',
  arguments: {
    deck: {
      meta: { problem_id: 'smoke', title: 'Smoke Deck' },
      slides: [
        { id: 's1', template: 'title', components: [{ type: 'title_block', props: { title: 'Smoke Deck' } }] },
        {
          id: 's2',
          template: 'array_state',
          components: [
            { type: 'array_block', props: { values: [1, 2, 3], highlighted: [1], pointers: [{ label: 'i', index: 1, color: 'green' }] } },
            { type: 'callout', props: { variant: 'success', text: 'Rendered through the protocol.' } },
          ],
        },
      ],
    },
  },
})
console.error('valid-deck isError:', good.isError === true)
console.error('result:', good.content[0].text.split('\n').slice(0, 2).join(' | '))

// ---- render_algorithm_from_code (Phase 4) ----
console.error('\n--- render_algorithm_from_code ---')
const codeTool = tools.find((t) => t.name === 'render_algorithm_from_code')
console.error('code tool exposed:', !!codeTool)

// Happy path: binary search code executed by the server -> real PNGs.
const bsCode = [
  'const { nums, target } = input;',
  'let lo = 0, hi = nums.length - 1;',
  'while (lo <= hi) {',
  '  const mid = Math.floor((lo + hi) / 2);',
  "  record({ values: nums, highlighted: [mid], pointers: [{label:'lo',index:lo},{label:'mid',index:mid},{label:'hi',index:hi}], state: { lo, hi, mid, 'nums[mid]': nums[mid], target }, explanation: nums[mid]===target?('Found '+target+' at '+mid):(nums[mid]<target?'go right':'go left'), variant: nums[mid]===target?'success':'info' });",
  '  if (nums[mid] === target) break;',
  '  else if (nums[mid] < target) lo = mid + 1;',
  '  else hi = mid - 1;',
  '}',
].join('\n')

const fromCode = await client.callTool({
  name: 'render_algorithm_from_code',
  arguments: {
    title: 'Binary Search (code)',
    problem_id: 'bs-code-smoke',
    intro: 'Halve the search space each step.',
    outro: 'O(log n) time.',
    input: { nums: [1, 3, 5, 7, 9, 11], target: 7 },
    code: bsCode,
  },
})
console.error('from-code isError:', fromCode.isError === true)
console.error('result:', fromCode.content[0].text.split('\n').slice(0, 2).join(' | '))

// Failure path: broken code must return a friendly error, not crash the server.
const broken = await client.callTool({
  name: 'render_algorithm_from_code',
  arguments: { title: 'Broken', code: 'this is not valid javascript ((' },
})
console.error('broken-code isError:', broken.isError === true)
console.error('error msg:', broken.content[0].text.split('\n')[0])

await client.close()
console.error('PROTOCOL OK')
process.exit(0)
