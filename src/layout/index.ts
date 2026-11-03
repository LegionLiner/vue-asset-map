import type { LayoutEngine } from './types'
import { manualLayout } from './manual'
import { radialLayout } from './radial'

export type { LayoutEngine, LayoutGraph, LayoutNode } from './types'
export { isLayoutAborted, isLayoutLimit, LayoutAbortedError, LayoutLimitError } from './types'
export { manualLayout } from './manual'
export type { ManualLayoutOptions } from './manual'
export { radialLayout } from './radial'
export type { RadialLayoutOptions } from './radial'
export { applyPinned, throwIfAborted } from './shared'
export { createWorkerLayout, exposeLayoutEngine } from './worker'
export type { LayoutWorker, LayoutWorkerScope } from './worker'

/**
 * Engines addressable by name out of the box.
 *
 * `dagre` is deliberately absent: it pulls an optional dependency and is opted
 * into through the `vue-asset-map/layout-dagre` subpath, then passed as an
 * object — `:layout="{ engine: dagreLayout }"`.
 */
export const builtinLayoutEngines: Readonly<Record<string, LayoutEngine>> = Object.freeze({
  [manualLayout.name]: manualLayout,
  [radialLayout.name]: radialLayout,
})

/**
 * Resolves an engine from a name or passes an instance through. An unknown name
 * yields `undefined` rather than throwing: the caller decides what happens next
 * (the map falls back to `manual` and reports it through the `error` event).
 */
export function resolveLayoutEngine(
  engine: string | LayoutEngine | undefined,
  extra?: Readonly<Record<string, LayoutEngine>>,
): LayoutEngine | undefined {
  if (engine === undefined) return undefined
  if (typeof engine !== 'string') return engine
  return extra?.[engine] ?? builtinLayoutEngines[engine]
}
