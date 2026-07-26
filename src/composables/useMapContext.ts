import { inject, provide, type Component, type ComputedRef, type InjectionKey, type Slot } from 'vue'
import type { EntityId, AssetEntity } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { CollapsedGroup } from '../types/collapse'
import type { Translate } from '../types/locale'
import type { ResolvedNodeMarker } from '../types/marker'

/** Direction of an arrow-key move across the map. */
export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

/**
 * Everything nodes and edges need from the map.
 *
 * Delivered through provide/inject rather than per-node props: these values are
 * shared by every node and change rarely (theme, locale, LOD), while
 * interactions have to reach the map directly, bypassing VueFlow's event system,
 * so behaviour does not depend on whether VueFlow's own selection is enabled.
 */
export interface MapContext {
  t: Translate
  graph: ComputedRef<AssetGraph<unknown, unknown>>

  /** Whether sublabels are shown under the label in the current view. */
  showSublabels: ComputedRef<boolean>
  /** `true` when zoom is below the LOD threshold and nodes render simplified. */
  simplified: ComputedRef<boolean>

  /** Whether the default node draws the status dot on its circle. */
  showNodeStatus: ComputedRef<boolean>
  /** Whether the default node draws the subtree toggle. */
  showNodeToggle: ComputedRef<boolean>
  /** Whether the default node draws the label plate under its circle. */
  showNodeLabel: ComputedRef<boolean>
  /**
   * The sublabels a node should draw: the entity's own, narrowed by the view, the
   * LOD level and `maxSublabels`.
   *
   * Resolved here rather than in the node so a custom node inherits the same
   * rules instead of reimplementing them.
   */
  sublabelsOf: (id: EntityId) => readonly string[]

  /**
   * Looks up a map slot by name.
   *
   * A function rather than the slots object itself: `AssetMap` describes its
   * slots with an exact type (`AssetMapSlots`), which is incompatible with
   * Vue's internal `Slots`. Lookup by name is all nodes, edges and the panel need.
   */
  slot: (name: string) => Slot | undefined

  statusColorOf: (status: string | undefined) => string | undefined
  iconFor: (type: string) => Component | undefined
  groupById: (groupId: string) => CollapsedGroup | undefined
  entityById: (id: EntityId) => AssetEntity<unknown> | undefined

  /** Root entities are drawn larger than children. */
  isRootNode: (id: string) => boolean
  /** Only nodes with descendants show the subtree toggle. */
  hasChildren: (id: string) => boolean
  isSubtreeCollapsed: (id: string) => boolean
  onToggleSubtree: (id: string) => void

  isSelected: (id: string) => boolean
  isMatched: (id: string) => boolean
  isDimmed: (id: string) => boolean
  isHighlighted: (id: string) => boolean
  isEdgeHighlighted: (edgeId: string) => boolean
  isEdgeDimmed: (edgeId: string) => boolean

  /** Membership markers of a node: the dots under its label. */
  markersFor: (id: EntityId) => readonly ResolvedNodeMarker[]
  onMarkerEnter: (markerId: string) => void
  onMarkerLeave: () => void
  onMarkerFocus: (markerId: string) => void

  /** The node falls inside the infection spread. */
  isInfected: (id: string) => boolean
  /** The node was marked by hand rather than captured by the spread. */
  isInfectionSource: (id: string) => boolean
  isEdgeInfected: (edgeId: string) => boolean

  onNodeClick: (id: string, event: MouseEvent) => void
  onNodeDoubleClick: (id: string, event: MouseEvent) => void
  onNodeContextMenu: (id: string, event: MouseEvent) => void
  onGroupToggle: (groupId: string, event: Event) => void
  onEdgeClick: (edgeId: string, event: MouseEvent) => void

  /** Keyboard: move to a neighbour in the given direction. */
  onArrowNavigate: (id: string, direction: ArrowDirection) => void
  registerNodeElement: (id: string, element: HTMLElement | undefined) => void
}

export const MAP_CONTEXT_KEY: InjectionKey<MapContext> = Symbol('vam-map-context')

/** Publishes the context; called by `<AssetMap>` and nothing else. */
export function provideMapContext(context: MapContext): void {
  provide(MAP_CONTEXT_KEY, context)
}

/**
 * Reads the map context inside a node or an edge.
 *
 * Throws a legible error when the component is rendered outside `<AssetMap>`;
 * without it a consumer would get `undefined is not a function` somewhere deep
 * inside the render of their custom node.
 */
export function useMapContext(): MapContext {
  const context = inject(MAP_CONTEXT_KEY, undefined)
  if (!context) {
    throw new Error('[vue-asset-map] Node and edge components must be rendered inside <AssetMap>')
  }
  return context
}
