// Types for normalize.mjs (shared Scene -> Slide[] logic). One implementation,
// consumed by both the Node scripts and the strict-mode Vite app.
import type { ComponentInstance, Deck, Scene, Slide, Step } from '../types/deck'

export function applyPatch(
  components: ComponentInstance[],
  patch?: Step['patch'],
): ComponentInstance[]

export function flattenScene(scene: Scene): Slide[]

export function normalizeDeck(deck: Deck): Deck
