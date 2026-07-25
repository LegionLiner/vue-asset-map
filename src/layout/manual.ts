import type { EntityId, XY } from '../types/entity'
import type { LayoutEngine, LayoutGraph } from './types'
import { applyPinned, unpinnedNodes, yieldAndCheck } from './shared'

/** Options of {@link manualLayout}. */
export interface ManualLayoutOptions {
  /**
   * Nodes per grid row.
   *
   * @default 8
   */
  columns?: number
  /**
   * Horizontal grid step, in px.
   *
   * @default widest node + 48
   */
  columnGap?: number
  /**
   * Vertical grid step, in px.
   *
   * @default tallest node + 48
   */
  rowGap?: number
  /** Canvas position of the grid's top-left corner. */
  origin?: XY
}

const DEFAULT_COLUMNS = 8
const DEFAULT_GAP = 48

/**
 * As-supplied layout: pinned positions are kept untouched, everything else goes
 * into a deterministic grid.
 *
 * The point is not to look good but to lose no coordinates. It is the engine to
 * use when positions come from a backend, and the baseline for tests: the result
 * depends only on the order of the input array.
 */
export const manualLayout: LayoutEngine<ManualLayoutOptions> = {
  name: 'manual',

  async run(graph: LayoutGraph, options?: ManualLayoutOptions, signal?: AbortSignal) {
    await yieldAndCheck(signal, 'manual')

    const columns = Math.max(1, options?.columns ?? DEFAULT_COLUMNS)
    const origin = options?.origin ?? { x: 0, y: 0 }
    const loose = unpinnedNodes(graph.nodes)

    // Stepped by the largest node so cards of mixed sizes cannot overlap.
    const maxWidth = loose.reduce((max, node) => Math.max(max, node.width), 0)
    const maxHeight = loose.reduce((max, node) => Math.max(max, node.height), 0)
    const columnGap = options?.columnGap ?? maxWidth + DEFAULT_GAP
    const rowGap = options?.rowGap ?? maxHeight + DEFAULT_GAP

    const positions = new Map<EntityId, XY>()
    loose.forEach((node, index) => {
      positions.set(node.id, {
        x: origin.x + (index % columns) * columnGap,
        y: origin.y + Math.floor(index / columns) * rowGap,
      })
    })

    return applyPinned(positions, graph.nodes)
  },
}
