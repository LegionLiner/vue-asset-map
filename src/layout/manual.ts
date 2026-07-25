import type { EntityId, XY } from '../types/entity'
import type { LayoutEngine, LayoutGraph } from './types'
import { applyPinned, unpinnedNodes, yieldAndCheck } from './shared'

export interface ManualLayoutOptions {
  /** Сколько узлов в строке сетки. Дефолт 8. */
  columns?: number
  /** Шаг сетки по горизонтали. Дефолт — ширина узла + 48. */
  columnGap?: number
  /** Шаг сетки по вертикали. Дефолт — высота узла + 48. */
  rowGap?: number
  origin?: XY
}

const DEFAULT_COLUMNS = 8
const DEFAULT_GAP = 48

/**
 * Раскладка «как прислали»: закреплённые позиции сохраняются как есть, всё
 * остальное выкладывается в детерминированную сетку.
 *
 * Смысл движка — не рисовать красиво, а не терять координаты. Это дефолт для
 * случая, когда позиции приходят с бэкенда, и опорная точка для тестов:
 * результат зависит только от порядка входного массива.
 */
export const manualLayout: LayoutEngine<ManualLayoutOptions> = {
  name: 'manual',

  async run(graph: LayoutGraph, options?: ManualLayoutOptions, signal?: AbortSignal) {
    await yieldAndCheck(signal, 'manual')

    const columns = Math.max(1, options?.columns ?? DEFAULT_COLUMNS)
    const origin = options?.origin ?? { x: 0, y: 0 }
    const loose = unpinnedNodes(graph.nodes)

    // Шаг сетки — по самому крупному узлу, чтобы карточки не наезжали друг на
    // друга при разнородных размерах.
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
