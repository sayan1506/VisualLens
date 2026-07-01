import type { Deck } from './types/deck'

declare global {
  interface Window {
    // MCP render path injects the deck here before the app mounts.
    __DECK__?: Deck
  }
}

export {}
