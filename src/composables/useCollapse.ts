import { computed, type ComputedRef, type Ref } from 'vue'
import { collapseGraph } from '../core/collapse'
import type { EntityId } from '../types/entity'
import type { CollapsedGroup, CollapseResult, CollapseRule } from '../types/collapse'
import type { NetworkGraph } from '../types/graph'
import type { ProjectionResult } from '../types/view'

export interface UseCollapseReturn {
  collapsed: ComputedRef<CollapseResult<unknown>>
  groups: ComputedRef<readonly CollapsedGroup[]>
  groupById: ComputedRef<ReadonlyMap<string, CollapsedGroup>>
  isExpanded: (groupId: string) => boolean
  expand: (groupId: string) => void
  collapse: (groupId: string) => void
  toggle: (groupId: string) => boolean
  /** Скрыто ли поддерево этой сущности кнопкой на самом узле. */
  isSubtreeCollapsed: (id: EntityId) => boolean
  toggleSubtree: (id: EntityId) => boolean
}

/**
 * Свёртка групп поверх видимого подграфа.
 *
 * Выполняется до раскладки: позиции считаются уже по схлопнутому графу, иначе
 * групповой узел встал бы на место, рассчитанное для 14 отдельных.
 *
 * `expanded` — множество снаружи (`v-model:expanded`). Мутировать его на месте
 * нельзя: реактивность на `Set` в Vue работает, но потребитель мог передать
 * обычное множество из своего стора, поэтому наружу всегда уходит новый `Set`.
 */
export function useCollapse<E, L>(
  graph: Ref<NetworkGraph<E, L>> | ComputedRef<NetworkGraph<E, L>>,
  visibleIds: Ref<ReadonlySet<EntityId>> | ComputedRef<ReadonlySet<EntityId>>,
  projection: Ref<ProjectionResult> | ComputedRef<ProjectionResult>,
  rule: Ref<CollapseRule | false | undefined>,
  expanded: Ref<Set<string>>,
  collapsedParents?: Ref<Set<EntityId>>,
): UseCollapseReturn {
  const collapsed: ComputedRef<CollapseResult<unknown>> = computed(() =>
    collapseGraph(graph.value, {
      ...(rule.value !== undefined ? { rule: rule.value } : {}),
      expandedIds: expanded.value,
      visibleEntityIds: visibleIds.value,
      visibleLinkIds: projection.value.linkIds,
      ...(collapsedParents ? { collapsedParentIds: collapsedParents.value } : {}),
    }),
  )

  const groups = computed(() => collapsed.value.groups)
  const groupById = computed(() => new Map(groups.value.map((group) => [group.id, group])))

  const isExpanded = (groupId: string): boolean => expanded.value.has(groupId)

  const expand = (groupId: string): void => {
    if (expanded.value.has(groupId)) return
    const next = new Set(expanded.value)
    next.add(groupId)
    expanded.value = next
  }

  const collapse = (groupId: string): void => {
    if (!expanded.value.has(groupId)) return
    const next = new Set(expanded.value)
    next.delete(groupId)
    expanded.value = next
  }

  /** Возвращает новое состояние: `true` — раскрыта. */
  const toggle = (groupId: string): boolean => {
    if (isExpanded(groupId)) {
      collapse(groupId)
      return false
    }
    expand(groupId)
    return true
  }

  const isSubtreeCollapsed = (id: EntityId): boolean => collapsedParents?.value.has(id) === true

  /** Возвращает новое состояние: `true` — поддерево скрыто. */
  const toggleSubtree = (id: EntityId): boolean => {
    if (!collapsedParents) return false

    const next = new Set(collapsedParents.value)
    const nowCollapsed = !next.has(id)
    if (nowCollapsed) next.add(id)
    else next.delete(id)

    collapsedParents.value = next
    return nowCollapsed
  }

  return {
    collapsed,
    groups,
    groupById,
    isExpanded,
    expand,
    collapse,
    toggle,
    isSubtreeCollapsed,
    toggleSubtree,
  }
}
