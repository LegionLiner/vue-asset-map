import * as dagre from '@dagrejs/dagre'
import type { EntityId, XY } from '../types/entity'
import type { LayoutEngine, LayoutGraph } from './types'
import { applyPinned, yieldAndCheck } from './shared'

export interface DagreLayoutOptions {
  /** Направление ярусов: сверху вниз, слева направо и т.д. Дефолт `TB`. */
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL'
  /** Выравнивание внутри яруса. */
  align?: 'UL' | 'UR' | 'DL' | 'DR'
  /** Зазор между узлами одного яруса. Дефолт 48. */
  nodesep?: number
  /** Зазор между ярусами. Дефолт 96. */
  ranksep?: number
  /** Зазор между рёбрами. Дефолт 24. */
  edgesep?: number
  /** Алгоритм расстановки по ярусам. Дефолт `network-simplex`. */
  ranker?: 'network-simplex' | 'tight-tree' | 'longest-path'
}

const DEFAULTS = {
  rankdir: 'TB',
  nodesep: 48,
  ranksep: 96,
  edgesep: 24,
  ranker: 'network-simplex',
} as const

/**
 * Ярусная раскладка на dagre.
 *
 * Живёт в отдельном подпути `network-map/layout-dagre`, а `@dagrejs/dagre` —
 * в `optionalDependencies`: движок нужен не всем, а весит он больше, чем всё
 * остальное ядро. Кто импортировал этот модуль — тот и поставил зависимость.
 *
 * Dagre не умеет фиксировать узлы, поэтому закреплённые позиции возвращаются
 * поверх результата: снаружи поведение такое же, как у остальных движков.
 */
export const dagreLayout: LayoutEngine<DagreLayoutOptions> = {
  name: 'dagre',

  async run(graph: LayoutGraph, options?: DagreLayoutOptions, signal?: AbortSignal) {
    await yieldAndCheck(signal, 'dagre')

    const positions = new Map<EntityId, XY>()
    if (graph.nodes.length === 0) return positions

    const inner = new dagre.graphlib.Graph({ directed: true, multigraph: true, compound: false })
    inner.setGraph({
      rankdir: options?.rankdir ?? DEFAULTS.rankdir,
      nodesep: options?.nodesep ?? DEFAULTS.nodesep,
      ranksep: options?.ranksep ?? DEFAULTS.ranksep,
      edgesep: options?.edgesep ?? DEFAULTS.edgesep,
      ranker: options?.ranker ?? DEFAULTS.ranker,
      ...(options?.align ? { align: options.align } : {}),
    })
    inner.setDefaultEdgeLabel(() => ({}))

    for (const node of graph.nodes) {
      inner.setNode(node.id, { width: node.width, height: node.height })
    }

    const known = new Set(graph.nodes.map((node) => node.id))
    for (const edge of graph.edges) {
      if (!known.has(edge.source) || !known.has(edge.target)) continue
      // multigraph: имя ребра различает параллельные связи, иначе dagre
      // оставил бы от пучка только одно.
      inner.setEdge(edge.source, edge.target, {}, edge.id)
    }

    dagre.layout(inner)
    await yieldAndCheck(signal, 'dagre')

    for (const node of graph.nodes) {
      const laid = inner.node(node.id)
      if (!laid) continue
      // Dagre отдаёт центр узла, а карта позиционирует по левому верхнему углу.
      positions.set(node.id, { x: laid.x - node.width / 2, y: laid.y - node.height / 2 })
    }

    return applyPinned(positions, graph.nodes)
  },
}

export default dagreLayout
