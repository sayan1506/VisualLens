# VisualLens

Turn any array, tree, or graph algorithm into a step-by-step visual explainer — as PNG slides or an interactive player — driven by your own AI assistant.

VisualLens is an [MCP](https://modelcontextprotocol.io) server. You ask Claude (or any MCP-capable host) to "visualize binary search," Claude produces a structured slide deck, and VisualLens renders it into polished slides using a fixed catalog of hand-designed React components. No API keys, no paid services — the intelligence comes from the AI host you already use.

## How it works

```
Claude Desktop ──(deck JSON via MCP)──> VisualLens server ──> React render ──> PNG slides + interactive player
```

There are two tools:

- **`render_algorithm_deck`** — Claude hand-authors the deck (it traces the values itself). Simple, works for any visual, but the model can make arithmetic mistakes on hard problems.
- **`render_algorithm_from_code`** — Claude writes a short JS solution instrumented with `record()` calls; the server **runs it in a sandbox** so every value on every slide is computed by the real JS engine. Preferred for correctness.

> Note on "guaranteed correct": the sandbox guarantees the slides match what the code computed — it does **not** guarantee the algorithm Claude wrote is bug-free. On genuinely hard problems Claude can still write buggy code, and the slides will faithfully show the buggy result.

### What a walkthrough step looks like

Each step renders as a **docked scoreboard**: a header band (problem title, optional difficulty badge and Big-O chips, step counter), the visualization on the left, the code and state panels docked on the right, and the step's plain-English caption in a strip along the bottom — all on screen at once, so a learner reads the code, the values, and the picture together. The visualization scales to fit its zone, so large arrays and long code lines never clip. Decks that show multiple approaches (brute force → optimized) surface them as approach tabs in the player. Title and intro/outro slides keep a simpler centered layout.

## Prerequisites

- **Node.js 20+** (developed on Node 22)
- **[Claude Desktop](https://claude.ai/download)** (or another MCP host) to drive it
- ~150 MB free for the Playwright Chromium download

## Install

```bash
git clone https://github.com/sayan1506/VisualLens.git
cd VisualLens
npm install
npx playwright install chromium   # one-time headless-browser download
npm run build                     # produces dist/ — the server renders from this
```

## Quick start (no AI needed)

Prove the pipeline works before wiring up Claude. Several example decks ship in `src/examples/`:

```bash
# Render a deck to PNG slides → out/two-sum-ii/slide-01.png ...
npm run deck two-sum-ii

# Open the same deck in the interactive player (browser)
npm run play two-sum-ii
```

Available examples: `two-sum-ii`, `binary-search`, `two-sum-scene`, `two-sum-approaches`, `container-with-most-water`, `sort-colors`, `tree-max-depth`, `graph-bfs`. `tree-max-depth` and `graph-bfs` exercise the tree and graph visualizers; `container-with-most-water` uses the bar-chart component; `sort-colors` uses per-cell value coloring (Dutch National Flag).

`two-sum-scene` demonstrates the **scene** model: instead of a fresh slide per step, the components are declared once and each step patches their props, so the player animates values in place across the walkthrough. `two-sum-approaches` shows **multiple approaches** in one deck (brute force → two pointers), which the player surfaces as approach tabs.

In the player: **←/→** or **Space** to navigate, **Play** to auto-advance, click the dots to jump, and click an approach tab (on multi-approach decks) to switch solutions. `Ctrl+C` in the terminal to stop.

## Connect to Claude Desktop

1. Open your Claude Desktop config file:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add a `visuallens` entry under `mcpServers` (merge into any existing servers, don't overwrite). Use the **absolute path** to `scripts/mcp-server.mjs` in your clone:

   ```json
   {
     "mcpServers": {
       "visuallens": {
         "command": "node",
         "args": ["/absolute/path/to/VisualLens/scripts/mcp-server.mjs"]
       }
     }
   }
   ```

   > On Windows, use double backslashes: `"C:\\Users\\you\\VisualLens\\scripts\\mcp-server.mjs"`.
   > If Claude Desktop can't find `node` (it doesn't always inherit your PATH), replace `"command": "node"` with the full path to your node binary — e.g. `"C:\\Program Files\\nodejs\\node.exe"` or the output of `which node`.

3. **Fully quit** Claude Desktop (tray/menu → Quit, not just close the window) and reopen it. You should see `render_algorithm_deck` and `render_algorithm_from_code` in the tools list.

4. Try a prompt:

   > Visualize how binary search finds 7 in [1, 3, 5, 7, 9, 11] using render_algorithm_from_code.

Slides land in `out/<slug>/`. The tool's reply includes a `npm run play <slug>` command to view that deck interactively.

## Viewing output

- **PNG slides:** `out/<slug>/slide-01.png`, `slide-02.png`, …
- **Interactive player:** `npm run play <slug>` (a `deck.json` is saved alongside the PNGs so any generated deck can be replayed)

## What works well

Best on **clearly multi-step** algorithms over a single structure:

- Two pointers — Two Sum II, Container With Most Water
- Running state — Best Time to Buy/Sell Stock, Kadane's maximum subarray
- Sliding window — longest substring, window maximum
- Sorting — bubble / insertion / selection, Dutch National Flag (lots of steps = rich decks)
- Trees — DFS/BFS traversals, max depth (binary tree as a level-order array)
- Graphs — BFS/DFS, shortest-path walks over a hand-laid-out node set

## Current limitations

- **Fixed catalog of shapes.** The component catalog covers arrays, bar charts, binary trees, graphs, pointers, code, state, callouts, and text. There is still **no linked-list, DP-grid, or stack** visualizer — those problems fall back to awkward array/text slides.
- **One structure at a time.** Each run visualizes a single array, tree, *or* graph. Two-structure problems (e.g. Median of Two Sorted Arrays, merging two lists) can't be drawn properly yet.
- **Trees are binary + level-order.** A tree is supplied as a LeetCode-style level-order array (index 0 = root, children of `i` at `2i+1`/`2i+2`). N-ary trees aren't supported.
- **Graph layout is manual.** Node positions are normalized `x`/`y` coordinates the host LLM chooses — there is no automatic graph layout.
- **Slide count follows the algorithm.** The deck is `title + intro + one slide per recorded step + outro`. Binary search on a small array is ~3 steps, so you get ~6 slides. Use a larger input or a step-heavier algorithm for more.
- **No video / audio.** Output is PNGs and the interactive player only.
- **Local-only trust model.** `render_algorithm_from_code` runs AI-written JS in a `node:vm` + worker sandbox with a timeout. That's fine for your own machine; it is **not** hardened for a public/remote deployment.

## npm scripts

| Script | What it does |
|--------|--------------|
| `npm run build` | Build the render bundle (`dist/`) — **required before the server can render** |
| `npm run mcp` | Start the MCP server directly (Claude Desktop does this for you) |
| `npm run deck <name>` | Render an example deck to PNGs (dev mode, live components) |
| `npm run deck:file <path>` | Render any deck JSON file to PNGs |
| `npm run play <name\|slug\|path>` | Serve a deck in the interactive player |
| `npm run dev` | Vite dev server (component development) |
| `npm run typecheck` | TypeScript check |

## Development notes

- **The MCP server renders from `dist/`.** After editing any component or template, run `npm run build` or the server keeps rendering the old look. (For iterating on visuals, `npm run deck` / `npm run dev` use live dev mode.)
- **Components live in `src/components/`**, templates in `src/slides/`, the deck schema in `src/types/deck.ts`.
- Adding a new visual = add a component, extend the schema + validator, and describe it in the tool's authoring guide in `scripts/mcp-server.mjs`.

## Project structure

```
src/
  components/       preloaded render catalog (ArrayBlock, BarChart, Tree, Graph, CodePanel, StatePanel, ...)
  slides/           SlideRenderer + template layouts
  types/deck.ts     the deck JSON schema (AI ↔ renderer contract)
  schema/limits.json  single source of truth for limits + enum lists
  lib/normalize.mjs   expands scenes → flat slides (called on read everywhere)
  examples/         hand-written example decks
  Player.tsx        interactive deck player
scripts/
  mcp-server.mjs    the MCP server (two tools)
  lib/              sandbox runner, validator, deck builder, render pipeline
out/                generated slides (gitignored)
```

## License

MIT
