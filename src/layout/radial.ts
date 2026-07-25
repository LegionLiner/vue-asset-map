import type { EntityId, XY } from '../types/entity'
import type { LayoutEngine, LayoutGraph } from './types'
import { adjacencyOf, applyPinned, pickRoot, yieldAndCheck } from './shared'

export interface RadialLayoutOptions {
  /** Центр раскладки. По умолчанию — узел наибольшей степени. */
  rootId?: EntityId
  /** Радиус первого кольца. Дефолт 220. */
  radius?: number
  /** Прирост радиуса на каждое следующее кольцо. Дефолт 180. */
  ringGap?: number
  /** Угол первого узла кольца в радианах. Дефолт `-Math.PI / 2` — вверх. */
  startAngle?: number
  center?: XY
}

const DEFAULT_RADIUS = 220
const DEFAULT_RING_GAP = 180
const DEFAULT_START_ANGLE = -Math.PI / 2

/**
 * Концентрические кольца по расстоянию от корня.
 *
 * Ровно то, что нужно карте сети: в физическом виде центр — «Интернет», в
 * логическом — координатор VPN, и на глаз сразу видно, сколько хопов до узла.
 *
 * Компоненты, не связанные с корнем, не выбрасываются: они получают кольца
 * дальше самого дальнего связанного, поэтому изоляты остаются видимыми.
 */
export const radialLayout: LayoutEngine<RadialLayoutOptions> = {
  name: 'radial',

  async run(graph: LayoutGraph, options?: RadialLayoutOptions, signal?: AbortSignal) {
    await yieldAndCheck(signal, 'radial')

    const positions = new Map<EntityId, XY>()
    if (graph.nodes.length === 0) return positions

    const center = options?.center ?? { x: 0, y: 0 }
    const radius = options?.radius ?? DEFAULT_RADIUS
    const ringGap = options?.ringGap ?? DEFAULT_RING_GAP
    const startAngle = options?.startAngle ?? DEFAULT_START_ANGLE

    const rings = ringsFrom(graph, options?.rootId)

    rings.forEach((ids, depth) => {
      if (depth === 0) {
        const rootId = ids[0]
        if (rootId !== undefined) positions.set(rootId, { x: center.x, y: center.y })
        return
      }

      const ringRadius = radius + (depth - 1) * ringGap
      const step = (Math.PI * 2) / ids.length
      ids.forEach((id, index) => {
        const angle = startAngle + index * step
        positions.set(id, {
          x: center.x + Math.cos(angle) * ringRadius,
          y: center.y + Math.sin(angle) * ringRadius,
        })
      })
    })

    return applyPinned(positions, graph.nodes)
  },
}

/**
 * Разбивает узлы на кольца по расстоянию от корня в рёбрах.
 *
 * Обход в ширину идёт по порядку входного массива узлов и рёбер, поэтому
 * порядок внутри кольца — и, значит, углы — детерминированы.
 */
function ringsFrom(graph: LayoutGraph, preferredRoot?: EntityId): EntityId[][] {
  const adjacency = adjacencyOf(graph)
  const root = pickRoot(graph, preferredRoot)
  const rings: EntityId[][] = []
  const visited = new Set<EntityId>()

  if (root !== undefined) {
    rings.push([root])
    visited.add(root)

    let frontier = [root]
    while (frontier.length > 0) {
      const next: EntityId[] = []
      for (const current of frontier) {
        for (const neighbor of adjacency.get(current) ?? []) {
          if (visited.has(neighbor)) continue
          visited.add(neighbor)
          next.push(neighbor)
        }
      }
      if (next.length > 0) rings.push(next)
      frontier = next
    }
  }

  // Узлы, не достижимые из корня: своё кольцо за пределами связной части.
  const orphans = graph.nodes.map((node) => node.id).filter((id) => !visited.has(id))
  if (orphans.length > 0) rings.push(orphans)

  return rings
}
