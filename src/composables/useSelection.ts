import { computed, type ComputedRef, type Ref } from 'vue'
import type { EntityId } from '../types/entity'

export interface UseSelectionReturn {
  selectedIds: ComputedRef<ReadonlySet<EntityId>>
  primaryId: ComputedRef<EntityId | undefined>
  isSelected: (id: EntityId) => boolean
  select: (id: EntityId, additive?: boolean) => void
  deselect: (id: EntityId) => void
  toggle: (id: EntityId, additive?: boolean) => void
  clear: () => void
  replace: (ids: readonly EntityId[]) => void
}

/**
 * Выделение узлов.
 *
 * Наружу состояние уходит массивом (`v-model:selection`), внутри для проверок
 * держится множество: `includes` по массиву на каждый узел при каждом рендере —
 * квадратичная стоимость на больших картах.
 *
 * Порядок выделения сохраняется: «первый выделенный» — это то, что показывает
 * панель подробностей, а «два выделенных» — то, между чем строится путь.
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
      // Без Ctrl клик по уже выделенному оставляет его единственным выделенным:
      // так «клик по узлу» остаётся предсказуемым, а снятие делает клик по фону.
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
