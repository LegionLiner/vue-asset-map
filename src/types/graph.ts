import type { EntityId, NetworkEntity } from './entity'
import type { NetworkLink } from './link'

export interface NetworkGraph<E = unknown, L = unknown> {
  entities: ReadonlyMap<EntityId, NetworkEntity<E>>
  links: ReadonlyMap<string, NetworkLink<L>>
  /**
   * id сущности → id инцидентных рёбер.
   *
   * Каждое инцидентное ребро встречается ровно один раз, включая петлю
   * (`source === target` даёт одну запись, не две). Параллельные рёбра — разные
   * id, поэтому кратность связи сохраняется.
   */
  adjacency: ReadonlyMap<EntityId, readonly string[]>
  childrenOf: ReadonlyMap<EntityId, readonly EntityId[]>
  roots: readonly EntityId[]
  /**
   * id сущности → эффективный родитель (`null` для корня).
   *
   * «Эффективный» — уже после починки входных данных: ссылка в несуществующего
   * родителя и циклы в иерархии сведены к `null`.
   */
  parentOf: ReadonlyMap<EntityId, EntityId | null>

  /** id сущности → id рёбер, где она источник. Нужно для направленного обхода. */
  outgoing: ReadonlyMap<EntityId, readonly string[]>
  /** id сущности → id рёбер, где она цель. */
  incoming: ReadonlyMap<EntityId, readonly string[]>
}

/** Что построитель графа выбросил или починил во входных данных. */
export type GraphIssueCode =
  | 'duplicate-entity'
  | 'duplicate-link'
  | 'dangling-link'
  | 'missing-parent'
  | 'parent-cycle'
  | 'self-parent'

export interface GraphIssue {
  code: GraphIssueCode
  /** id проблемной сущности или связи */
  id: string
  detail?: string
}
