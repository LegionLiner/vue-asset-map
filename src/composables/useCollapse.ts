import { computed, nextTick, type ComputedRef, type Ref } from 'vue'
import { collapseGraph, collapsePageSize, isPageIdOf, pageIdFor } from '../core/collapse'
import { ancestorsOf } from '../core/graph'
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
  reveal: (id: EntityId, stillCurrent?: () => boolean) => Promise<boolean>
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

  async function reveal(id: EntityId, stillCurrent = () => true): Promise<boolean> {
    if (!visibleIds.value.has(id)) return false
    const branch = new Set([id, ...ancestorsOf(graph.value, id)])
    if (collapsedParents && [...branch].some((ancestor) => ancestor !== id && isSubtreeCollapsed(ancestor))) {
      collapsedParents.value = new Set(
        [...collapsedParents.value].filter((key) => key === id || !branch.has(key)),
      )
      await nextTick()
    }
    // A nested group becomes known only after its enclosing group opens. Jump to
    // the page containing the target without mounting all preceding siblings.
    const opened = new Set<string>()
    while (stillCurrent() && visibleIds.value.has(id)) {
      const owner = collapsed.value.groupOf.get(id)
      if (owner === undefined) return true
      const group = groupById.value.get(owner)
      if (!group || opened.has(owner)) return false
      opened.add(owner)
      const member = group.memberIds.findIndex((key) => branch.has(key))
      if (member < 0) return false
      const next = new Set(expanded.value)
      const groupId = group.remainderOf ?? owner
      next.add(groupId)
      const pageSize = collapsePageSize(rule.value || undefined)
      if (pageSize > 0) {
        let offset = group.offset ?? 0
        let remainingIndex = member
        while (remainingIndex >= pageSize || (group.remainderOf && next.has(pageIdFor(groupId, offset)))) {
          if (!next.has(pageIdFor(groupId, offset))) remainingIndex -= pageSize
          offset += pageSize
        }
        if (offset > 0) next.add(pageIdFor(groupId, offset))
      }
      expanded.value = next
      await nextTick()
    }
    return false
  }

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
    reveal,
  }
}
