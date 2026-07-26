import type { Component } from 'vue'
import type { Badge, EntityId, AssetEntity, XY } from './entity'
import type { AssetLink } from './link'
import type { AssetView } from './view'
import type { CollapsedGroup, CollapseRule } from './collapse'
import type { AssetGraph } from './graph'
import type { NodeMarkerDef } from './marker'
import type { FilterOptions, FilterState } from './filter'
import type { PartialLocaleMessages } from './locale'
import type { ThemeConfig, ThemeMode } from './theme'
import type { LayoutEngine } from '../layout/types'

/** Which layout engine to run, by registered name or as an instance. */
export interface AssetMapLayoutSpec {
  engine: string | LayoutEngine
  options?: unknown
}

/** How far an "infection" spreads from the entities marked as sources. */
export interface InfectionOptions {
  /**
   * Which way to follow links.
   *
   * @default 'downstream'
   */
  direction?: 'downstream' | 'upstream' | 'both'
  /**
   * Cap the spread at this many steps.
   *
   * @default unlimited
   */
  maxDepth?: number
  /**
   * Spread only across links on these layers.
   *
   * @default the layers of the current view
   */
  layers?: string[]
}

/** Canvas viewport: pan offset in px plus the zoom factor. */
export interface Viewport extends XY {
  zoom: number
}

/**
 * Every input of `<AssetMap>`.
 *
 * @typeParam E - payload type of `entity.meta`.
 * @typeParam L - payload type of `link.meta`.
 */
export interface AssetMapProps<E = unknown, L = unknown> {
  /** Read-only: the map never mutates the array or the entities in it. */
  entities: AssetEntity<E>[]
  /** Read-only, same as `entities`. */
  links: AssetLink<L>[]
  /** Available projections. With none, every entity and link is drawn. */
  views?: AssetView[]

  /** Node component registry: `type` → component. Merged over the built-in one. */
  nodeTypes?: Record<string, Component>
  edgeTypes?: Record<string, Component>

  layout?: AssetMapLayoutSpec
  /** `false` turns collapsing off; omitted means the default rule applies. */
  collapse?: CollapseRule | false
  filterOptions?: FilterOptions

  theme?: ThemeMode
  themeConfig?: ThemeConfig
  locale?: string | PartialLocaleMessages

  /**
   * Render the built-in controls. Turn off to drive everything through slots.
   *
   * @default true
   */
  showToolbar?: boolean
  showDetailsPanel?: boolean
  showMinimap?: boolean

  /**
   * How many details windows may stay open at once.
   *
   * The oldest window closes once the limit is reached. `0` disables windows
   * entirely without removing the rest of the UI.
   *
   * @default 2
   */
  maxDetailsWindows?: number

  /**
   * How many steps of a selected node's links stay highlighted.
   *
   * Anything farther is dimmed. `0` disables selection highlighting.
   *
   * @default 1
   */
  neighborHighlightDepth?: number

  /**
   * Entities marked as infection sources.
   *
   * The map shows more than these: the affected set is computed with
   * `blastRadius`, so the whole spread is visible at once.
   */
  infected?: EntityId[]
  infectionOptions?: InfectionOptions

  /**
   * Membership markers drawn under node labels.
   *
   * Dot order follows this array, so the same marker sits in the same slot on
   * every node.
   */
  markers?: NodeMarkerDef[]
  /**
   * Delay before hovering a dot highlights its members, in ms.
   *
   * @default 500
   */
  markerHoverDelay?: number

  /**
   * Mount only the nodes and edges inside the viewport.
   *
   * @default true
   */
  onlyRenderVisibleElements?: boolean
  /**
   * Zoom below which nodes render in their simplified form.
   *
   * @default 0.5
   */
  lodThreshold?: number
  /**
   * Delay before a typed query is applied, in ms.
   *
   * @default 200
   */
  searchDebounce?: number
  /** Show a loading overlay above the canvas. */
  loading?: boolean

  /**
   * Fit the canvas to its content whenever the visible nodes finish laying
   * out — on mount, and again after a view switch, a group collapse/expand or
   * a layout engine change reshapes what's on screen.
   *
   * Off by default: an application that manages its own `viewport` (a saved
   * position, a deliberate `focus` on load) should not have that overridden.
   * Waits on Vue Flow's own node-measurement signal rather than a fixed
   * delay, so it fires exactly once dimensions are known, never on a guess.
   *
   * @default false
   */
  autoFitView?: boolean
}

/** Two-way bindings. Without a `v-model` the component owns the state itself. */
export interface AssetMapModels {
  view?: string
  selection?: EntityId[]
  expanded?: Set<string>
  filters?: FilterState
  viewport?: Viewport
}

/** Payload of the node events. Exactly one of `entity` / `group` is set. */
export interface NodeEventPayload {
  id: string
  entity: AssetEntity<unknown> | undefined
  group: CollapsedGroup | undefined
  event: MouseEvent
}

/** Options of the imperative `focus`. */
export interface FocusOptions {
  /**
   * Zoom to settle on.
   *
   * @default the current zoom
   */
  zoom?: number
  /**
   * Animation duration in ms.
   *
   * @default 400
   */
  duration?: number
  /**
   * Select the node as well as centering on it.
   *
   * @default true
   */
  select?: boolean
}

/** Slot that receives no parameters. */
export type EmptySlotProps = Record<string, never>

/**
 * Parameters of the `node-*` slots.
 *
 * One type covers the whole family — both `#node-{type}` and `#node-badge`.
 * Otherwise they cannot share the `node-${string}` signature, and without that
 * signature TypeScript rejects an arbitrary slot name such as `#node-router`.
 */
export interface NodeSlotProps<E = unknown> {
  entity: AssetEntity<E> | undefined
  nodeId: string
  /** `true` when zoom is below the LOD threshold and the node renders simplified. */
  simplified: boolean
  /** Set for the `node-badge` slot only. */
  badge?: Badge
}

/** Parameters of the `details` slot: the body of a details window. */
export interface DetailsSlotProps<E = unknown> {
  entity: AssetEntity<E>
  close: () => void
  /** Id of the active tab. */
  tab: string
}

/** Parameters of the `details-header` slot: the window's title bar. */
export interface DetailsHeaderSlotProps<E = unknown> {
  entity: AssetEntity<E>
  close: () => void
}

/** Parameters of the `edge-label` slot; `count` is `1` unless `aggregated`. */
export interface EdgeLabelSlotProps<L = unknown> {
  link: AssetLink<L> | undefined
  aggregated: boolean
  count: number
}

/**
 * The public slot contract.
 *
 * Declared through `defineSlots` rather than inferred from the template: nodes
 * and edges render inside VueFlow and pull slots out of the map context, so
 * `AssetMap`'s own markup does not mention them.
 */
export type AssetMapSlots<E = unknown, L = unknown> = {
  'toolbar-left'?(props: EmptySlotProps): unknown
  'toolbar-right'?(props: EmptySlotProps): unknown
  empty?(props: EmptySlotProps): unknown
  loading?(props: EmptySlotProps): unknown
  /**
   * Custom floating windows above the canvas.
   *
   * Renders above the details windows. Build them out of the exported
   * `<MapWindow>` to inherit its title bar, dragging and theme tokens.
   */
  windows?(props: EmptySlotProps): unknown
  details?(props: DetailsSlotProps<E>): unknown
  'details-header'?(props: DetailsHeaderSlotProps<E>): unknown
  'edge-label'?(props: EdgeLabelSlotProps<L>): unknown
} & {
  [type: `node-${string}`]: ((props: NodeSlotProps<E>) => unknown) | undefined
}

/**
 * The component's imperative API — what `defineExpose` returns.
 *
 * Kept as a standalone type so consumers can annotate a template ref:
 * `InstanceType<typeof AssetMap>` is not usable on a generic component.
 */
export interface AssetMapExposed<E = unknown, L = unknown> {
  fitView: () => Promise<void>
  focus: (id: EntityId, options?: FocusOptions) => Promise<void>
  relayout: () => Promise<void>
  /** Returns the path in original entity ids, or an empty array if there is none. */
  highlightPath: (from: EntityId, to: EntityId) => EntityId[]
  clearHighlight: () => void
  getGraph: () => AssetGraph<E, L>
}
