import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { applyFilters, facetCounts, isFilterActive } from '../core/filter'
import type { EntityId } from '../types/entity'
import type { FacetCounts, FilterOptions, FilterResult, FilterState } from '../types/filter'
import type { AssetGraph } from '../types/graph'
import type { ProjectionResult } from '../types/view'

/** Return value of {@link useFilters}. */
export interface UseFiltersReturn {
  result: ComputedRef<FilterResult>
  /** Counted over the projection, so counts do not collapse as you select. */
  facets: ComputedRef<FacetCounts>
  active: ComputedRef<boolean>
  /** Entities surviving both the view and the filter. */
  visibleIds: ComputedRef<ReadonlySet<EntityId>>
  /** Direct hits; these are the ones the render highlights. */
  matchedIds: ComputedRef<ReadonlySet<EntityId>>
}

const DEFAULT_DEBOUNCE_MS = 200

/**
 * Search and facet filtering on top of the view projection.
 *
 * Debouncing lives here rather than in `core`: the core stays a synchronous pure
 * function, while "do not recompute the graph on every keystroke" is a property
 * of the UI. Only the text query is debounced — clicking a facet is a single
 * deliberate act, and delaying it would just feel sluggish.
 */
export function useFilters<E, L>(
  graph: Ref<AssetGraph<E, L>> | ComputedRef<AssetGraph<E, L>>,
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
      // Clearing the field applies at once: no reason to wait to get the map back.
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

  // State carrying the debounced query — this is what reaches the core.
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

  // Facets are counted over the projection, not over the filter result: picking
  // "offline" would otherwise zero every other counter, leaving nowhere to go
  // back to. Group definitions come along, since values are collected from them.
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
