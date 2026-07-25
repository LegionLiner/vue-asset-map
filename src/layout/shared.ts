import type { EntityId, XY } from '../types/entity'
import { LayoutAbortedError, type LayoutGraph, type LayoutNode } from './types'

/** Throws {@link LayoutAbortedError} when the run has already been cancelled. */
export function throwIfAborted(signal: AbortSignal | undefined, engineName: string): void {
  if (signal?.aborted) throw new LayoutAbortedError(engineName)
}

/**
 * Yields to the event loop, checking for cancellation on both sides of the gap.
 *
 * Synchronous engines need this too: without a real suspension point, `run()`
 * followed by an immediate `abort()` would still return a result, and the "stale
 * result is never applied" rule would only hold for slow engines.
 */
export async function yieldAndCheck(signal: AbortSignal | undefined, engineName: string): Promise<void> {
  throwIfAborted(signal, engineName)
  await Promise.resolve()
  throwIfAborted(signal, engineName)
}

/**
 * Overwrites engine output with the pinned positions, mutating and returning the
 * map it is given.
 *
 * One place for every engine: an engine need not support fixed nodes (dagre does
 * not), yet the behaviour seen from outside has to be identical.
 */
export function applyPinned(positions: Map<EntityId, XY>, nodes: readonly LayoutNode[]): Map<EntityId, XY> {
  for (const node of nodes) {
    if (node.pinned) positions.set(node.id, { x: node.pinned.x, y: node.pinned.y })
  }
  return positions
}

/** Nodes with no pinned position — the ones an engine actually has to place. */
export function unpinnedNodes(nodes: readonly LayoutNode[]): LayoutNode[] {
  return nodes.filter((node) => node.pinned === undefined)
}

/**
 * Undirected adjacency lists over the layout graph, self-loops excluded.
 *
 * Edges pointing at unknown nodes are ignored: layout receives an already
 * collapsed graph, where some ends have been replaced by group nodes.
 */
export function adjacencyOf(graph: LayoutGraph): Map<EntityId, EntityId[]> {
  const known = new Set(graph.nodes.map((node) => node.id))
  const adjacency = new Map<EntityId, EntityId[]>()
  for (const node of graph.nodes) adjacency.set(node.id, [])

  for (const edge of graph.edges) {
    if (!known.has(edge.source) || !known.has(edge.target)) continue
    if (edge.source === edge.target) continue
    adjacency.get(edge.source)?.push(edge.target)
    adjacency.get(edge.target)?.push(edge.source)
  }

  return adjacency
}

/** Node degrees, used to pick a root when none was given. */
export function degreesOf(graph: LayoutGraph): Map<EntityId, number> {
  const degrees = new Map<EntityId, number>()
  for (const [id, neighbors] of adjacencyOf(graph)) degrees.set(id, neighbors.length)
  return degrees
}

/**
 * The layout root: `preferred` when it exists in the graph, otherwise the node of
 * highest degree.
 *
 * Ties go to whichever node comes first in the input array; without that rule
 * the layout would stop being deterministic.
 */
export function pickRoot(graph: LayoutGraph, preferred?: EntityId): EntityId | undefined {
  if (preferred !== undefined && graph.nodes.some((node) => node.id === preferred)) return preferred

  const degrees = degreesOf(graph)
  let best: EntityId | undefined
  let bestDegree = -1
  for (const node of graph.nodes) {
    const degree = degrees.get(node.id) ?? 0
    if (degree > bestDegree) {
      best = node.id
      bestDegree = degree
    }
  }
  return best
}
