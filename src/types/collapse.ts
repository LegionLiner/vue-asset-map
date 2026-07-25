import type { EntityId, NetworkEntity } from './entity'
import type { NetworkLink } from './link'

export interface CollapseRule {
  /** Свернуть, если детей больше этого числа. Дефолт 10. */
  threshold?: number
  /** Ключ группировки внутри одного родителя. Дефолт — по kind. */
  groupBy?: (entity: NetworkEntity) => string | null
  /** Полное переопределение решения */
  shouldCollapse?: (parentId: EntityId | null, children: readonly NetworkEntity[]) => boolean
}

export interface CollapsedGroup {
  /** Формат: `group:<parentId>:<bucket>` */
  id: string
  parentId: EntityId | null
  bucket: string
  memberIds: EntityId[]
  /** Рёбра, оба конца которых оказались внутри группы: не рисуются, но считаются. */
  internalLinkCount: number
}

export interface AggregatedLink<L = unknown> extends NetworkLink<L> {
  aggregated: true
  /** Сколько исходных рёбер схлопнуто в это */
  count: number
  sourceLinkIds: string[]
}

/** Ребро на схлопнутом графе: либо перенесённое исходное, либо агрегат. */
export type CollapsedLink<L = unknown> = NetworkLink<L> | AggregatedLink<L>

export interface CollapseResult<L = unknown> {
  groups: readonly CollapsedGroup[]
  /** id участника (и любого его потомка) → id группы, которая его прячет */
  groupOf: ReadonlyMap<EntityId, string>
  /** Сущности, спрятанные внутрь групп */
  hiddenIds: ReadonlySet<EntityId>
  /** Узлы схлопнутого графа: id сущностей + id групп, в детерминированном порядке */
  nodeIds: readonly string[]
  links: readonly CollapsedLink<L>[]
}
