import type { EntityId } from './entity'

export interface NetworkLink<M = unknown> {
  id: string
  source: EntityId
  target: EntityId
  /** Слои, к которым относится связь. Проекция вида фильтрует по ним. */
  layers: string[]
  /** Визуальный вид ребра: 'solid' | 'dashed' | ... — определяет стиль */
  kind?: string
  label?: string
  directed?: boolean
  meta?: M
}
