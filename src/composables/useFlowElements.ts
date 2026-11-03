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
  /** Whether a node may start or receive a drawn link. */
  connectable: Ref<boolean>
}

/** Return value of {@link useFlowElements}: ready to feed to `<VueFlow>`. */
export interface UseFlowElementsReturn {
  /** Every node, positioned and with the filter applied. */
  nodes: ComputedRef<Node[]>
  edges: ComputedRef<Edge[]>
  /**
   * Every node by id, with neither position nor filter applied.
   *
   * Rebuilt only when the data or the collapse changes. A drag or a keystroke
   * in the search used to rebuild every node object on the map for the sake of
   * one position or one `hidden` flag; these stay put, and {@link materialize}
   * finishes only the nodes actually being handed to VueFlow.
   */
  nodeTemplates: ComputedRef<ReadonlyMap<string, Node>>
  /** Every edge by id, filter not applied. */
  edgeTemplates: ComputedRef<ReadonlyMap<string, Edge>>
  /** Whether a node survives the filter; a group does while any member does. */
  isVisible: (id: string) => boolean
  /**
   * The given nodes and edges, positioned and filtered, ready for VueFlow.
   *
   * Nodes the filter hides are left out rather than sent with `hidden`, and so
   * is any edge touching one: what is not shown need not be mounted.
   */
  materialize: (nodeIds: Iterable<string>, edgeIds: Iterable<string>) => { nodes: Node[]; edges: Edge[] }
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
  const { graph, collapsed, positionOf, filterVisibleIds, nodeTypes, edgeTypes, draggable, connectable } =
    params

  const groupById = computed(() => new Map(collapsed.value.groups.map((group) => [group.id, group])))

  // A group counts as visible while any single member survives the filter.
  const isVisible = (id: string): boolean => {
    const visible = filterVisibleIds.value
    if (!visible) return true

    const group = groupById.value.get(id)
    if (group) return group.memberIds.some((memberId) => visible.has(memberId))
    return visible.has(id)
  }

  const nodeTemplates = computed<ReadonlyMap<string, Node>>(() => {
    const types = nodeTypes.value
    const canDrag = draggable.value
    const canConnect = connectable.value
    const templates = new Map<string, Node>()

    for (const id of collapsed.value.nodeIds) {
      const group = groupById.value.get(id)

      if (group) {
        // A group is not a record, so nothing can be linked to or from it: a
        // link to a group would have no entity at one of its ends.
        templates.set(id, buildNode(id, NODE_TYPE_GROUP, { variant: 'group', group }, canDrag, false))
        continue
      }

      const entity = graph.value.entities.get(id)
      if (!entity) {
        // A node without an entity can only mean a bug in the core, but that is
        // no reason to blank the render — fall back to the base node type.
        templates.set(id, buildNode(id, nodeTypeFor('', types), undefined, canDrag, false))
        continue
      }

      templates.set(
        id,
        buildNode(id, nodeTypeFor(entity.type, types), { variant: 'entity', entity }, canDrag, canConnect),
      )
    }

    return templates
  })

  const edgeTemplates = computed<ReadonlyMap<string, Edge>>(() => {
    const types = edgeTypes.value
    const templates = new Map<string, Edge>()

    for (const link of collapsed.value.links) {
      const aggregated = isAggregatedLink(link)

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
      }

      if (link.label !== undefined) edge.label = link.label
      if (link.directed === true) {
        edge.markerEnd = MarkerType.ArrowClosed
      }

      // Only set when the link names one: passing `undefined` would still count
      // as naming a handle to VueFlow, and it would resolve to nothing.
      if (link.sourceHandle !== undefined) edge.sourceHandle = link.sourceHandle
      if (link.targetHandle !== undefined) edge.targetHandle = link.targetHandle

      templates.set(link.id, edge)
    }

    return templates
  })

  const nodes = computed<Node[]>(() => {
    const out: Node[] = []
    for (const template of nodeTemplates.value.values()) {
      out.push({
        ...template,
        position: positionOf(template.id) ?? FALLBACK_POSITION,
        hidden: !isVisible(template.id),
      })
    }
    return out
  })

  const edges = computed<Edge[]>(() => {
    const out: Edge[] = []
    for (const template of edgeTemplates.value.values()) {
      out.push({ ...template, hidden: !isVisible(template.source) || !isVisible(template.target) })
    }
    return out
  })

  const materialize = (
    nodeIds: Iterable<string>,
    edgeIds: Iterable<string>,
  ): { nodes: Node[]; edges: Edge[] } => {
    const templates = nodeTemplates.value
    const outNodes: Node[] = []
    for (const id of nodeIds) {
      const template = templates.get(id)
      if (!template || !isVisible(id)) continue
      outNodes.push({ ...template, position: positionOf(id) ?? FALLBACK_POSITION })
    }

    const edgeById = edgeTemplates.value
    const outEdges: Edge[] = []
    for (const id of edgeIds) {
      const template = edgeById.get(id)
      if (!template || !isVisible(template.source) || !isVisible(template.target)) continue
      outEdges.push(template)
    }

    return { nodes: outNodes, edges: outEdges }
  }

  return { nodes, edges, nodeTemplates, edgeTemplates, isVisible, materialize }
}

function buildNode(
  id: string,
  type: string,
  data: AssetNodeData | undefined,
  draggable: boolean,
  connectable: boolean,
): Node {
  return {
    id,
    type,
    position: FALLBACK_POSITION,
    ...(data ? { data } : {}),
    draggable,
    // Per-node, not just the graph-wide `nodesConnectable`: VueFlow reads this
    // one last, so a hardcoded `false` here silently defeats the prop.
    connectable,
    // Selection and focus belong to the map: VueFlow keeps selection state of
    // its own, and two sources of truth for one selection always drift apart.
    selectable: false,
    focusable: false,
  }
}
