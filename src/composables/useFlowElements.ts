import { computed, type ComputedRef, type Ref } from 'vue'
import { MarkerType, type Edge, type Node } from '@vue-flow/core'
import type { Component } from 'vue'
import type { EntityId, NetworkEntity, XY } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { CollapsedGroup, CollapseResult, CollapsedLink } from '../types/collapse'
import { isAggregatedLink } from '../core/collapse'
import { edgeTypeFor, nodeTypeFor, NODE_TYPE_GROUP } from '../registry/nodeRegistry'

/** Данные узла-сущности. */
export interface EntityNodeData<E = unknown> {
  variant: 'entity'
  entity: NetworkEntity<E>
}

/** Данные группового узла. */
export interface GroupNodeData {
  variant: 'group'
  group: CollapsedGroup
}

export type NetworkNodeData<E = unknown> = EntityNodeData<E> | GroupNodeData

export interface NetworkEdgeData {
  link: CollapsedLink<unknown>
  aggregated: boolean
  count: number
}

export interface UseFlowElementsParams<E, L> {
  graph: ComputedRef<NetworkGraph<E, L>>
  collapsed: ComputedRef<CollapseResult<unknown>>
  positionOf: (id: string) => XY | undefined
  /** Видимые после фильтра. `undefined` — фильтр неактивен, видно всё. */
  filterVisibleIds: ComputedRef<ReadonlySet<EntityId> | undefined>
  nodeTypes: ComputedRef<Readonly<Record<string, Component>>>
  edgeTypes: ComputedRef<Readonly<Record<string, Component>>>
  draggable: Ref<boolean>
}

export interface UseFlowElementsReturn {
  nodes: ComputedRef<Node[]>
  edges: ComputedRef<Edge[]>
}

const FALLBACK_POSITION: XY = { x: 0, y: 0 }

/**
 * Преобразование схлопнутого графа в элементы VueFlow.
 *
 * Что здесь важно:
 *  - в `data` попадает минимум: сущность или группа. Всё изменчивое (выделение,
 *    подсветка, LOD) узлы читают из контекста карты, поэтому смена выделения не
 *    заставляет пересобирать массив узлов;
 *  - скрытие фильтром — через `node.hidden`, штатный механизм VueFlow: иначе
 *    рёбра продолжали бы тянуться к невидимым узлам;
 *  - групповой узел виден, пока виден хоть один его участник, иначе группа
 *    исчезала бы при поиске по одному из своих членов.
 */
export function useFlowElements<E, L>(params: UseFlowElementsParams<E, L>): UseFlowElementsReturn {
  const { graph, collapsed, positionOf, filterVisibleIds, nodeTypes, edgeTypes, draggable } = params

  const groupById = computed(() => new Map(collapsed.value.groups.map((group) => [group.id, group])))

  /** Виден ли узел схлопнутого графа с точки зрения фильтра. */
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
        // Узел без сущности означать может только ошибку в ядре, но гасить из-за
        // этого весь рендер нельзя — показываем заглушку базового типа.
        return buildNode(id, nodeTypeFor('', types), position, undefined, canDrag, isVisible(id))
      }

      return buildNode(
        id,
        nodeTypeFor(entity.kind, types),
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
        type: edgeTypeFor(link.kind, types),
        data: {
          link,
          aggregated,
          count: aggregated ? link.count : 1,
        } satisfies NetworkEdgeData,
        // Клики по рёбрам обрабатывает сам компонент ребра.
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
  data: NetworkNodeData | undefined,
  draggable: boolean,
  visible: boolean,
): Node {
  return {
    id,
    type,
    position,
    ...(data ? { data } : {}),
    draggable,
    // Выделение и фокус ведёт сама карта: у VueFlow своё состояние выделения, и
    // два источника истины на одно выделение неизбежно расходятся.
    selectable: false,
    focusable: false,
    connectable: false,
    hidden: !visible,
  }
}
