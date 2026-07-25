import type { EntityId, NetworkEntity } from './entity'

export interface FilterState {
  query: string
  /** Пустой массив = все типы */
  kinds: string[]
  statuses: string[]
  predicate?: (entity: NetworkEntity) => boolean
}

export interface FilterResult {
  /** Прямые совпадения — их подсвечиваем */
  matchedIds: Set<EntityId>
  /** Что вообще остаётся на карте */
  visibleIds: Set<EntityId>
}

export interface FilterOptions {
  /** Показывать соседей совпавших узлов на N шагов. Дефолт 1. */
  neighborDepth?: number
  /** Сохранять цепочку до корня, чтобы граф не рассыпался. Дефолт true. */
  keepPathToRoot?: boolean
  /** Поля для текстового поиска. Дефолт: label + sublabels. */
  searchFields?: (entity: NetworkEntity) => string[]
  /**
   * Ограничить фильтр подграфом (обычно — результатом проекции вида).
   * Дефолт: весь граф.
   */
  restrictTo?: ReadonlySet<EntityId>
  /** Расширять до соседей только по этим слоям связей. Дефолт: по всем. */
  layers?: readonly string[]
}

/** Сколько сущностей приходится на каждое значение фасета. */
export interface FacetCounts {
  kinds: ReadonlyMap<string, number>
  statuses: ReadonlyMap<string, number>
}
