# VisualLens

Turn any array algorithm into a step-by-step visual explainer — as PNG slides or an interactive player — driven by your own AI assistant.

VisualLens is an [MCP](https://modelcontextprotocol.io) server. You ask Claude (or any MCP-capable host) to "visualize binary search," Claude produces a structured slide deck, and VisualLens renders it into polished slides using a fixed catalog of hand-designed React components. No API keys, no paid services — the intelligence comes from the AI host you already use.

## How it works

```
Claude Desktop ──(deck JSON via MCP)──> VisualLens server ──> React render ──> PNG slides + interactive player
```

There are two tools:

- **`render_algorithm_deck`** — Claude hand-authors the deck (it traces the values itself). Simple, works for any visual, but the model can make arithmetic mistakes on hard problems.
- **`render_algorithm_from_code`** — Claude writes a short JS solution instrumented with `record()` calls; the server **runs it in a sandbox** so every value on every slide is computed by the real JS engine. Preferred for correctness.

> Note on "guaranteed correct": the sandbox guarantees the slides match what the code computed — it does **not** guarantee the algorithm Claude wrote is bug-free. On genuinely hard problems Claude can still write buggy code, and the slides will faithfully show the buggy result.

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

Prove the pipeline works before wiring up Claude. Two example decks ship in `src/examples/`:

```bash
# Render a deck to PNG slides → out/two-sum-ii/slide-01.png ...
npm run deck two-sum-ii

# Open the same deck in the interactive player (browser)
npm run play two-sum-ii          # also: binary-search
```

In the player: **←/→** or **Space** to navigate, **Play** to auto-advance, click the dots to jump. `Ctrl+C` in the terminal to stop.

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

Best on **single-array, clearly multi-step** algorithms:

- Two pointers — Two Sum II, Container With Most Water
- Running state — Best Time to Buy/Sell Stock, Kadane's maximum subarray
- Sliding window — longest substring, window maximum
- Sorting — bubble / insertion / selection (lots of steps = rich decks)

## Current limitations

- **Array-shaped visuals only.** The component catalog covers arrays, pointers, code, state, callouts, and text. There is **no tree, graph, linked-list, DP-grid, or stack** visualizer yet — those problems fall back to awkward array/text slides.
- **One array at a time.** Two-structure problems (e.g. Median of Two Sorted Arrays, merging two lists) can't be drawn properly yet.
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
  components/     preloaded render catalog (ArrayBlock, CodePanel, StatePanel, ...)
  slides/         SlideRenderer + template layouts
  types/deck.ts   the deck JSON schema (AI ↔ renderer contract)
  examples/       hand-written example decks
  Player.tsx      interactive deck player
scripts/
  mcp-server.mjs  the MCP server (two tools)
  lib/            sandbox runner, validator, deck builder, render pipeline
out/              generated slides (gitignored)
```

## License

MIT
