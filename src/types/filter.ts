import type { EntityId, NetworkEntity } from './entity'

export interface FilterState {
  query: string
  /** Пустой массив = все типы */
  kinds: string[]
  statuses: string[]
  predicate?: (entity: NetworkEntity) => boolean
  /**
   * Выбранные значения произвольных групп фильтра: id группы → значения.
   *
   * Пакет не знает, какими бывают «подсеть» или «критичность»: группы задаёт
   * потребитель через `FilterOptions.groups`, а здесь лежит только выбор.
   */
  groups?: Record<string, string[]>
}

/** Значение в группе фильтра. */
export interface FilterGroupOption {
  value: string
  /** Подпись. Без неё показывается само значение. */
  label?: string
}

/**
 * Описание группы фильтра.
 *
 * Группы — данные, а не код: «Подсеть», «Тип актива», «Критичность» задаёт
 * потребитель. Пакет умеет только собрать значения из сущностей и сопоставить
 * выбор с ними.
 */
export interface FilterGroupDef {
  id: string
  label: string
  /**
   * Значения группы. Если не заданы, собираются из данных через `valuesOf`.
   */
  options?: readonly FilterGroupOption[]
  /**
   * Какие значения группы несёт сущность. Дефолт — её `kind`.
   *
   * Через него же собираются значения и считаются счётчики, поэтому одной
   * функции достаточно и для отбора, и для фасетов.
   */
  valuesOf?: (entity: NetworkEntity) => readonly string[]
  /** Раскрыта ли группа по умолчанию. Дефолт `true`. */
  defaultOpen?: boolean
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
  /** Группы фильтра, по которым сужается выборка. */
  groups?: readonly FilterGroupDef[]
}

/** Сколько сущностей приходится на каждое значение фасета. */
export interface FacetCounts {
  kinds: ReadonlyMap<string, number>
  statuses: ReadonlyMap<string, number>
  /** id группы → значение → число сущностей. */
  groups: ReadonlyMap<string, ReadonlyMap<string, number>>
}
