import type { EntityId, XY } from '../types/entity'

/** One node handed to a layout engine. Sizes are in canvas px. */
export interface LayoutNode {
  id: EntityId
  width: number
  height: number
  /** Fixed position that must survive the engine, in canvas px. */
  pinned?: XY
}

/** Input of a layout engine: the collapsed graph, stripped of presentation data. */
export interface LayoutGraph {
  nodes: LayoutNode[]
  edges: { id: string; source: EntityId; target: EntityId }[]
}

/**
 * A pluggable positioning algorithm.
 *
 * `run` must honour `signal` — the map aborts a stale run whenever the data or
 * the view changes — and reject with {@link LayoutAbortedError} when it does.
 * Positions are top-left corners in canvas px, keyed by node id; nodes left out
 * of the returned map keep their current position.
 *
 * @typeParam O - engine-specific options object.
 */
export interface LayoutEngine<O = unknown> {
  name: string
  run(graph: LayoutGraph, options?: O, signal?: AbortSignal): Promise<Map<EntityId, XY>>
}

/**
 * Thrown when a layout run is aborted. A dedicated class rather than a string in
 * `Error`: `useLayout` swallows cancellation silently and must not swallow
 * genuine engine failures along with it.
 */
export class LayoutAbortedError extends Error {
  override readonly name = 'LayoutAbortedError'

  constructor(engineName: string) {
    super(`Layout "${engineName}" was aborted`)
  }
}

/** Type guard for {@link LayoutAbortedError}, for use in `catch` blocks. */
export function isLayoutAborted(error: unknown): error is LayoutAbortedError {
  return error instanceof LayoutAbortedError
}
