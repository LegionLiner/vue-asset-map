import { computed, type ComputedRef, type Ref } from 'vue'
import type { EntityId } from '../types/entity'

/** Return value of {@link useSelection}. */
export interface UseSelectionReturn {
  selectedIds: ComputedRef<ReadonlySet<EntityId>>
  /** First selected id: what the details panel shows. */
  primaryId: ComputedRef<EntityId | undefined>
  isSelected: (id: EntityId) => boolean
  /** `additive` adds to the selection instead of replacing it. */
  select: (id: EntityId, additive?: boolean) => void
  deselect: (id: EntityId) => void
  toggle: (id: EntityId, additive?: boolean) => void
  clear: () => void
  replace: (ids: readonly EntityId[]) => void
}

/**
 * Node selection.
 *
 * The state leaves as an array (`v-model:selection`) but is mirrored into a set
 * for lookups: an `includes` per node per render is quadratic on large maps.
 *
 * Selection order is preserved: "first selected" is what the details panel
 * shows, and "two selected" is what a path is traced between.
 */
export function useSelection(selection: Ref<EntityId[]>): UseSelectionReturn {
  const selectedIds = computed<ReadonlySet<EntityId>>(() => new Set(selection.value))

  const primaryId = computed(() => selection.value[0])

  const isSelected = (id: EntityId): boolean => selectedIds.value.has(id)

  const replace = (ids: readonly EntityId[]): void => {
    selection.value = [...ids]
  }

  const select = (id: EntityId, additive = false): void => {
    if (!additive) {
      if (selection.value.length === 1 && selection.value[0] === id) return
      replace([id])
      return
    }
    if (isSelected(id)) return
    replace([...selection.value, id])
  }

  const deselect = (id: EntityId): void => {
    if (!isSelected(id)) return
    replace(selection.value.filter((candidate) => candidate !== id))
  }

  const toggle = (id: EntityId, additive = false): void => {
    if (isSelected(id)) {
      // A plain click on an already selected node leaves it as the only
      // selection; clearing is what clicking the background is for.
      if (additive) deselect(id)
      else replace([id])
      return
    }
    select(id, additive)
  }

  const clear = (): void => {
    if (selection.value.length === 0) return
    replace([])
  }

  return { selectedIds, primaryId, isSelected, select, deselect, toggle, clear, replace }
}
