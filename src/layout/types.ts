import type { EntityId, XY } from '../types/entity'

export interface LayoutNode {
  id: EntityId
  width: number
  height: number
  pinned?: XY
}

export interface LayoutGraph {
  nodes: LayoutNode[]
  edges: { id: string; source: EntityId; target: EntityId }[]
}

export interface LayoutEngine<O = unknown> {
  name: string
  run(graph: LayoutGraph, options?: O, signal?: AbortSignal): Promise<Map<EntityId, XY>>
}

/**
 * Отмена раскладки. Отдельный класс, а не строка в `Error`: `useLayout` должен
 * молча проглатывать именно отмену и не глушить настоящие ошибки движка.
 */
export class LayoutAbortedError extends Error {
  override readonly name = 'LayoutAbortedError'

  constructor(engineName: string) {
    super(`Layout "${engineName}" was aborted`)
  }
}

export function isLayoutAborted(error: unknown): error is LayoutAbortedError {
  return error instanceof LayoutAbortedError
}
