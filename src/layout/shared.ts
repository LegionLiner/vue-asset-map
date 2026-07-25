import type { EntityId, XY } from '../types/entity'
import { LayoutAbortedError, type LayoutGraph, type LayoutNode } from './types'

/** Бросает `LayoutAbortedError`, если запрос уже отменён. */
export function throwIfAborted(signal: AbortSignal | undefined, engineName: string): void {
  if (signal?.aborted) throw new LayoutAbortedError(engineName)
}

/**
 * Уступает управление событийному циклу и снова проверяет отмену.
 *
 * Нужно даже синхронным движкам: без реальной точки прерывания вызов
 * `run()` + мгновенный `abort()` вернул бы результат, и требование «устаревший
 * результат не применяется» проверялось бы только на медленных движках.
 */
export async function yieldAndCheck(signal: AbortSignal | undefined, engineName: string): Promise<void> {
  throwIfAborted(signal, engineName)
  await Promise.resolve()
  throwIfAborted(signal, engineName)
}

/**
 * Закреплённые позиции побеждают результат движка.
 *
 * Единая точка для всех раскладок: движок может не уметь фиксировать узлы
 * (dagre не умеет), но снаружи поведение обязано быть одинаковым.
 */
export function applyPinned(positions: Map<EntityId, XY>, nodes: readonly LayoutNode[]): Map<EntityId, XY> {
  for (const node of nodes) {
    if (node.pinned) positions.set(node.id, { x: node.pinned.x, y: node.pinned.y })
  }
  return positions
}

/** Узлы, которые движок должен разложить сам. */
export function unpinnedNodes(nodes: readonly LayoutNode[]): LayoutNode[] {
  return nodes.filter((node) => node.pinned === undefined)
}

/**
 * Списки смежности по id узлов графа раскладки.
 *
 * Рёбра в несуществующие узлы игнорируются: раскладка получает уже схлопнутый
 * граф, где часть концов заменена групповыми узлами.
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

/** Степени узлов — по ним выбирается корень, если его не задали. */
export function degreesOf(graph: LayoutGraph): Map<EntityId, number> {
  const degrees = new Map<EntityId, number>()
  for (const [id, neighbors] of adjacencyOf(graph)) degrees.set(id, neighbors.length)
  return degrees
}

/**
 * Корень раскладки: заданный, иначе узел наибольшей степени.
 *
 * При равных степенях побеждает тот, кто раньше во входном массиве — иначе
 * раскладка перестала бы быть детерминированной.
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
