import type { EntityId } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import { matchesLayers, otherEnd } from './graph'

/** Options of {@link findPaths}. */
export interface FindPathsOptions {
  /**
   * Longest path to consider, measured in edges.
   *
   * @default 6
   */
  maxDepth?: number
  /**
   * Stop after this many paths.
   *
   * @default 10
   */
  maxPaths?: number
  layers?: readonly string[]
}

/** Options of {@link blastRadius}. */
export interface BlastRadiusOptions {
  /**
   * Which way influence propagates along directed links.
   *
   * @default 'both'
   */
  direction?: 'downstream' | 'upstream' | 'both'
  layers?: readonly string[]
  /**
   * Cap the radius at this many steps.
   *
   * @default unlimited
   */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 6
const DEFAULT_MAX_PATHS = 10

/**
 * Nodes within `depth` edges of `id`.
 *
 * `id` itself is never in the result, not even when a cycle makes it reachable
 * from itself: callers want the neighbourhood, not its closure.
 */
export function neighbors<E, L>(
  graph: AssetGraph<E, L>,
  id: EntityId,
  depth: number,
  layers?: readonly string[],
): Set<EntityId> {
  const result = new Set<EntityId>()
  if (depth <= 0 || !graph.entities.has(id)) return result

  const visited = new Set<EntityId>([id])
  let frontier: EntityId[] = [id]

  for (let step = 0; step < depth && frontier.length > 0; step += 1) {
    const next: EntityId[] = []
    for (const current of frontier) {
      for (const linkId of graph.adjacency.get(current) ?? []) {
        const link = graph.links.get(linkId)
        if (!link) continue
        if (layers && !matchesLayers(link, layers)) continue
        const neighbor = otherEnd(link, current)
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        result.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }

  return result
}

/**
 * Simple paths between two nodes.
 *
 * Paths are simple — no node repeats — so the walk terminates on any cycle.
 * Result order is deterministic: links are visited in `adjacency` order, which
 * is the order of the input links array.
 */
export function findPaths<E, L>(
  graph: AssetGraph<E, L>,
  from: EntityId,
  to: EntityId,
  opts: FindPathsOptions = {},
): EntityId[][] {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH
  const maxPaths = opts.maxPaths ?? DEFAULT_MAX_PATHS
  const { layers } = opts

  if (!graph.entities.has(from) || !graph.entities.has(to)) return []
  if (maxPaths <= 0) return []
  if (from === to) return [[from]]

  const paths: EntityId[][] = []
  const path: EntityId[] = [from]
  const onPath = new Set<EntityId>([from])

  const walk = (current: EntityId): void => {
    if (paths.length >= maxPaths) return
    // `path.length - 1` is the length in edges, not in nodes.
    if (path.length - 1 >= maxDepth) return

    for (const linkId of graph.adjacency.get(current) ?? []) {
      if (paths.length >= maxPaths) return
      const link = graph.links.get(linkId)
      if (!link) continue
      if (layers && !matchesLayers(link, layers)) continue
      const next = otherEnd(link, current)
      if (onPath.has(next)) continue

      path.push(next)
      if (next === to) {
        paths.push([...path])
      } else {
        onPath.add(next)
        walk(next)
        onPath.delete(next)
      }
      path.pop()
    }
  }

  walk(from)
  return paths
}

/**
 * What a node's failure reaches: the node itself plus everything influence
 * spreads to. Also drives the infection overlay.
 *
 * `direction` only constrains directed links (`directed === true`). An
 * undirected link is walked both ways whatever `direction` says, because it
 * carries no claim about which end depends on which.
 */
export function blastRadius<E, L>(
  graph: AssetGraph<E, L>,
  id: EntityId,
  opts: BlastRadiusOptions = {},
): Set<EntityId> {
  const direction = opts.direction ?? 'both'
  const { layers } = opts
  const maxDepth = opts.maxDepth ?? Number.POSITIVE_INFINITY

  const result = new Set<EntityId>()
  if (!graph.entities.has(id)) return result
  result.add(id)

  let frontier: EntityId[] = [id]
  let depth = 0

  while (frontier.length > 0 && depth < maxDepth) {
    const next: EntityId[] = []
    for (const current of frontier) {
      for (const linkId of graph.adjacency.get(current) ?? []) {
        const link = graph.links.get(linkId)
        if (!link) continue
        if (layers && !matchesLayers(link, layers)) continue

        const traversable =
          direction === 'both' ||
          link.directed !== true ||
          (direction === 'downstream' ? link.source === current : link.target === current)
        if (!traversable) continue

        const neighbor = otherEnd(link, current)
        if (result.has(neighbor)) continue
        result.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
    depth += 1
  }

  return result
}
