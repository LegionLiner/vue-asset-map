import type { EntityId } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import { matchesLayers, otherEnd } from './graph'

export interface FindPathsOptions {
  /** Максимальная длина пути в рёбрах. Дефолт 6. */
  maxDepth?: number
  /** Сколько путей вернуть. Дефолт 10. */
  maxPaths?: number
  layers?: readonly string[]
}

export interface BlastRadiusOptions {
  direction?: 'downstream' | 'upstream' | 'both'
  layers?: readonly string[]
  /** Ограничить радиус числом шагов. Дефолт — без ограничения. */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 6
const DEFAULT_MAX_PATHS = 10

/**
 * Узлы на расстоянии до `depth` рёбер от `id`.
 *
 * Сам `id` в результат не входит — даже если он достижим из себя по циклу:
 * потребителю нужны «соседи», а не «замкнутая окрестность».
 */
export function neighbors<E, L>(
  graph: NetworkGraph<E, L>,
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
 * Простые пути между двумя узлами.
 *
 * Пути простые — узел не повторяется, поэтому обход завершается на любом цикле.
 * Порядок результатов детерминирован: рёбра перебираются в порядке индекса
 * `adjacency`, то есть в порядке входного массива связей.
 */
export function findPaths<E, L>(
  graph: NetworkGraph<E, L>,
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
    // path.length - 1 — длина в рёбрах.
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
 * Что затронет отказ узла: сам узел плюс всё, до чего распространяется влияние.
 *
 * Направление считается только по ориентированным рёбрам (`directed === true`).
 * Неориентированное ребро проходится в обе стороны при любом `direction` — по
 * такому ребру нельзя утверждать, кто от кого зависит.
 */
export function blastRadius<E, L>(
  graph: NetworkGraph<E, L>,
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
