import { computed, type ComputedRef, type Ref } from 'vue'
import { collapseGraph, isPageIdOf } from '../core/collapse'
import type { EntityId } from '../types/entity'
import type { CollapsedGroup, CollapseResult, CollapseRule } from '../types/collapse'
import type { AssetGraph } from '../types/graph'
import type { ProjectionResult } from '../types/view'

/** Return value of {@link useCollapse}. */
export interface UseCollapseReturn {
  collapsed: ComputedRef<CollapseResult<unknown>>
  groups: ComputedRef<readonly CollapsedGroup[]>
  groupById: ComputedRef<ReadonlyMap<string, CollapsedGroup>>
  isExpanded: (groupId: string) => boolean
  expand: (groupId: string) => void
  collapse: (groupId: string) => void
  /** Returns the new state: `true` when the group is now expanded. */
  toggle: (groupId: string) => boolean
  /** Whether this entity's subtree is folded by the button on the node itself. */
  isSubtreeCollapsed: (id: EntityId) => boolean
  /** Returns the new state: `true` when the subtree is now hidden. */
  toggleSubtree: (id: EntityId) => boolean
}

/**
 * Group collapsing over the visible subgraph.
 *
 * Runs before layout: positions are computed on the collapsed graph, or a single
 * group node would land in space laid out for fourteen separate ones.
 *
 * `expanded` comes from outside (`v-model:expanded`) and is never mutated in
 * place: Vue does track `Set` mutations, but the consumer may have passed a
 * plain set out of their own store, so a new `Set` always goes back out.
 */
export function useCollapse<E, L>(
  graph: Ref<AssetGraph<E, L>> | ComputedRef<AssetGraph<E, L>>,
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

  // Folding a group also forgets how many of its pages were opened: unfolding
  // it again starts from the first page rather than dumping everything back.
  const collapse = (groupId: string): void => {
    if (!expanded.value.has(groupId)) return
    const next = new Set<string>()
    for (const id of expanded.value) {
      if (id !== groupId && !isPageIdOf(id, groupId)) next.add(id)
    }
    expanded.value = next
  }

  const toggle = (groupId: string): boolean => {
    if (isExpanded(groupId)) {
      collapse(groupId)
      return false
    }
    expand(groupId)
    return true
  }

  const isSubtreeCollapsed = (id: EntityId): boolean => collapsedParents?.value.has(id) === true

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
