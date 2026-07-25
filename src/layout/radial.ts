import type { EntityId, XY } from '../types/entity'
import type { LayoutEngine, LayoutGraph } from './types'
import { adjacencyOf, applyPinned, pickRoot, yieldAndCheck } from './shared'

/** Options of {@link radialLayout}. */
export interface RadialLayoutOptions {
  /**
   * Node placed at the centre.
   *
   * @default the node of highest degree
   */
  rootId?: EntityId
  /**
   * Radius of the first ring, in px.
   *
   * @default 220
   */
  radius?: number
  /**
   * Radius added by each further ring, in px.
   *
   * @default 180
   */
  ringGap?: number
  /**
   * Angle of the first node on a ring, in radians.
   *
   * @default -Math.PI / 2 (straight up)
   */
  startAngle?: number
  /** Canvas position of the centre. */
  center?: XY
}

const DEFAULT_RADIUS = 220
const DEFAULT_RING_GAP = 180
const DEFAULT_START_ANGLE = -Math.PI / 2

/**
 * Concentric rings by hop distance from the root, so ring number reads as hop
 * count.
 *
 * Components unreachable from the root are not dropped: they get a ring beyond
 * the farthest connected one, which keeps isolated nodes visible.
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
 * Splits nodes into rings by hop distance from the root.
 *
 * The breadth-first walk follows the order of the input node and edge arrays, so
 * the order within a ring — and therefore every angle — is deterministic.
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

  // Nodes unreachable from the root get one ring past the connected part.
  const orphans = graph.nodes.map((node) => node.id).filter((id) => !visited.has(id))
  if (orphans.length > 0) rings.push(orphans)

  return rings
}
