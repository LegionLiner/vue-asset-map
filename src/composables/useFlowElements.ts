import { computed, type ComputedRef, type Ref } from 'vue'
import { MarkerType, type Edge, type Node } from '@vue-flow/core'
import type { Component } from 'vue'
import type { EntityId, AssetEntity, XY } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { CollapsedGroup, CollapseResult, CollapsedLink } from '../types/collapse'
import { isAggregatedLink } from '../core/collapse'
import { edgeTypeFor, nodeTypeFor, NODE_TYPE_GROUP } from '../registry/nodeRegistry'

/** `node.data` of a node backed by a real entity. */
export interface EntityNodeData<E = unknown> {
  variant: 'entity'
  entity: AssetEntity<E>
}

/** `node.data` of a synthetic node standing in for a collapsed group. */
export interface GroupNodeData {
  variant: 'group'
  group: CollapsedGroup
}

/** `node.data` of any node on the map; discriminated by `variant`. */
export type AssetNodeData<E = unknown> = EntityNodeData<E> | GroupNodeData

/** `edge.data` of every edge on the map. */
export interface AssetEdgeData {
  link: CollapsedLink<unknown>
  aggregated: boolean
  /** Number of original links behind this edge; `1` unless `aggregated`. */
  count: number
}

/** Parameters of {@link useFlowElements}. */
export interface UseFlowElementsParams<E, L> {
  graph: ComputedRef<AssetGraph<E, L>>
  collapsed: ComputedRef<CollapseResult<unknown>>
  positionOf: (id: string) => XY | undefined
  /** Survivors of the filter; `undefined` means no filter is active. */
  filterVisibleIds: ComputedRef<ReadonlySet<EntityId> | undefined>
  nodeTypes: ComputedRef<Readonly<Record<string, Component>>>
  edgeTypes: ComputedRef<Readonly<Record<string, Component>>>
  draggable: Ref<boolean>
}

/** Return value of {@link useFlowElements}: ready to feed to `<VueFlow>`. */
export interface UseFlowElementsReturn {
  nodes: ComputedRef<Node[]>
  edges: ComputedRef<Edge[]>
}

const FALLBACK_POSITION: XY = { x: 0, y: 0 }

/**
 * Turns the collapsed graph into VueFlow nodes and edges.
 *
 * Invariants worth knowing:
 *  - `data` carries the bare minimum, an entity or a group. Everything volatile
 *    (selection, highlighting, LOD) is read from the map context instead, so
 *    changing the selection does not rebuild the node array;
 *  - filtering hides through `node.hidden`, VueFlow's own mechanism, or edges
 *    would keep reaching towards invisible nodes;
 *  - a group node stays visible while any one member matches, otherwise a group
 *    would vanish when searching for something inside it.
 */
export function useFlowElements<E, L>(params: UseFlowElementsParams<E, L>): UseFlowElementsReturn {
  const { graph, collapsed, positionOf, filterVisibleIds, nodeTypes, edgeTypes, draggable } = params

  const groupById = computed(() => new Map(collapsed.value.groups.map((group) => [group.id, group])))

  // A group counts as visible while any single member survives the filter.
  const isVisible = (id: string): boolean => {
    const visible = filterVisibleIds.value
    if (!visible) return true

    const group = groupById.value.get(id)
    if (group) return group.memberIds.some((memberId) => visible.has(memberId))
    return visible.has(id)
  }

  const nodes = computed<Node[]>(() => {
    const types = nodeTypes.value
    const canDrag = draggable.value

    return collapsed.value.nodeIds.map((id) => {
      const group = groupById.value.get(id)
      const position = positionOf(id) ?? FALLBACK_POSITION

      if (group) {
        return buildNode(id, NODE_TYPE_GROUP, position, { variant: 'group', group }, canDrag, isVisible(id))
      }

      const entity = graph.value.entities.get(id)
      if (!entity) {
        // A node without an entity can only mean a bug in the core, but that is
        // no reason to blank the render — fall back to the base node type.
        return buildNode(id, nodeTypeFor('', types), position, undefined, canDrag, isVisible(id))
      }

      return buildNode(
        id,
        nodeTypeFor(entity.type, types),
        position,
        { variant: 'entity', entity },
        canDrag,
        isVisible(id),
      )
    })
  })

  const edges = computed<Edge[]>(() => {
    const types = edgeTypes.value

    return collapsed.value.links.map((link) => {
      const aggregated = isAggregatedLink(link)
      const hidden = !isVisible(link.source) || !isVisible(link.target)

      const edge: Edge = {
        id: link.id,
        source: link.source,
        target: link.target,
        type: edgeTypeFor(link.type, types),
        data: {
          link,
          aggregated,
          count: aggregated ? link.count : 1,
        } satisfies AssetEdgeData,
        // Edge clicks are handled by the edge component itself.
        selectable: false,
        focusable: false,
        updatable: false,
        hidden,
      }

      if (link.label !== undefined) edge.label = link.label
      if (link.directed === true) {
        edge.markerEnd = MarkerType.ArrowClosed
      }

      return edge
    })
  })

  return { nodes, edges }
}

function buildNode(
  id: string,
  type: string,
  position: XY,
  data: AssetNodeData | undefined,
  draggable: boolean,
  visible: boolean,
): Node {
  return {
    id,
    type,
    position,
    ...(data ? { data } : {}),
    draggable,
    // Selection and focus belong to the map: VueFlow keeps selection state of
    // its own, and two sources of truth for one selection always drift apart.
    selectable: false,
    focusable: false,
    connectable: false,
    hidden: !visible,
  }
}
