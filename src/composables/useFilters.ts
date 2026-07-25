import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { applyFilters, facetCounts, isFilterActive } from '../core/filter'
import type { EntityId } from '../types/entity'
import type { FacetCounts, FilterOptions, FilterResult, FilterState } from '../types/filter'
import type { NetworkGraph } from '../types/graph'
import type { ProjectionResult } from '../types/view'

export interface UseFiltersReturn {
  result: ComputedRef<FilterResult>
  facets: ComputedRef<FacetCounts>
  active: ComputedRef<boolean>
  /** Видимые сущности с учётом и вида, и фильтра. */
  visibleIds: ComputedRef<ReadonlySet<EntityId>>
  /** Прямые совпадения — их подсвечивает рендер. */
  matchedIds: ComputedRef<ReadonlySet<EntityId>>
}

const DEFAULT_DEBOUNCE_MS = 200

/**
 * Поиск и фасетная фильтрация поверх проекции вида.
 *
 * Debounce живёт здесь, а не в `core`: ядро должно оставаться синхронной чистой
 * функцией, а «не пересчитывать граф на каждое нажатие клавиши» — свойство
 * интерфейса. Дебаунсится только текстовый запрос: клик по фасету — осознанное
 * единичное действие, задерживать его значит делать интерфейс вялым.
 */
export function useFilters<E, L>(
  graph: Ref<NetworkGraph<E, L>> | ComputedRef<NetworkGraph<E, L>>,
  projection: Ref<ProjectionResult> | ComputedRef<ProjectionResult>,
  filters: Ref<FilterState>,
  options: Ref<FilterOptions | undefined>,
  debounceMs: Ref<number | undefined>,
): UseFiltersReturn {
  const debouncedQuery = ref(filters.value.query)
  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  watch(
    () => filters.value.query,
    (query) => {
      clearTimer()
      const delay = debounceMs.value ?? DEFAULT_DEBOUNCE_MS
      // Очистка поля применяется сразу: ждать возврата всей карты незачем.
      if (delay <= 0 || query.length === 0) {
        debouncedQuery.value = query
        return
      }
      timer = setTimeout(() => {
        debouncedQuery.value = query
        timer = undefined
      }, delay)
    },
  )

  onScopeDispose(clearTimer)

  /** Состояние с уже отложенным запросом — именно оно идёт в ядро. */
  const effectiveState = computed<FilterState>(() => ({
    ...filters.value,
    query: debouncedQuery.value,
  }))

  const result = computed(() =>
    applyFilters(graph.value, effectiveState.value, {
      ...options.value,
      restrictTo: projection.value.entityIds,
    }),
  )

  // Фасеты считаются по проекции, а не по результату фильтра: иначе выбор
  // «offline» обнулил бы счётчики всех остальных значений, и вернуться было бы
  // некуда. Описания групп передаются сюда же — по ним собираются их значения.
  const facets = computed(() => facetCounts(graph.value, projection.value.entityIds, options.value?.groups))

  const active = computed(() => isFilterActive(effectiveState.value))

  return {
    result,
    facets,
    active,
    visibleIds: computed(() => result.value.visibleIds),
    matchedIds: computed(() => result.value.matchedIds),
  }
}
