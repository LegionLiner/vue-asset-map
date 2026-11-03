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

/**
 * Thrown by an engine asked to place more nodes than it is willing to.
 *
 * Dagre grows faster than linearly — half a second at 1 000 nodes, 15 s at
 * 5 000, with the tab frozen throughout — so past a limit it refuses rather than
 * hang. The map reports the error and falls back to the grid, which places any
 * number of nodes in linear time: a map that opens as a grid beats one that
 * does not open.
 */
export class LayoutLimitError extends Error {
  override readonly name = 'LayoutLimitError'

  constructor(
    readonly engineName: string,
    readonly nodeCount: number,
    readonly limit: number,
  ) {
    super(`Layout "${engineName}" refused ${nodeCount} nodes, the limit is ${limit}`)
  }
}

/**
 * Type guard for {@link LayoutLimitError}.
 *
 * Also matches by name: an error that crossed from a worker arrives as a plain
 * object rebuilt on this side, not as an instance of this class.
 */
export function isLayoutLimit(error: unknown): error is LayoutLimitError {
  return (
    error instanceof LayoutLimitError ||
    (error instanceof Error && error.name === 'LayoutLimitError' && 'limit' in error)
  )
}
