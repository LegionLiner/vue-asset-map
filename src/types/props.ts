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

/** How the map looks for the path it highlights between two nodes. */
export interface PathOptions {
  /**
   * Give up after this many hops.
   *
   * @default 12
   */
  maxDepth?: number
  /**
   * Follow only links on these layers.
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
 * One tab of a details window.
 *
 * `label` is a finished string rather than a locale key: the tabs a consumer
 * declares are their own, and the package's dictionary knows nothing about them.
 */
export interface DetailsTabDef {
  id: string
  label: string
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
   * Show the status dot on the node circle — the "online / offline" indicator.
   *
   * Turn it off when status is conveyed some other way, or not at all. The value
   * stays in the data either way; only this indicator disappears.
   *
   * @default true
   */
  showNodeStatus?: boolean
  /**
   * Show the button that folds a node's subtree away.
   *
   * @default true
   */
  showNodeToggle?: boolean
  /**
   * Show the label plate under the circle — label and sublabels both.
   *
   * `false` leaves the circle alone on the canvas. Layout still reserves the
   * plate's height, so switching this off does not reshape the map.
   *
   * @default true
   */
  showNodeLabel?: boolean
  /**
   * Cap on how many sublabels a node draws. `0` hides them entirely.
   *
   * There is no built-in limit: a node renders every sublabel the entity carries.
   * The plate grows to fit, so a cap is the way to keep nodes an even height.
   *
   * @default unlimited
   */
  maxSublabels?: number

  /**
   * Caption of a details window's title bar.
   *
   * A string is used as-is; a function receives the entity. Omitted, the window
   * is titled with `entity.label`.
   */
  detailsTitle?: string | ((entity: AssetEntity<E>) => string)
  /**
   * Show the heading block inside a details window — the large label with the
   * type and status line under it.
   *
   * @default true
   */
  showDetailsHeading?: boolean
  /**
   * Tabs of a details window. `false` removes the tab strip.
   *
   * Omitted, the window shows its two built-in tabs (overview and links). A
   * custom array replaces them; the active id reaches the `#details` slot as its
   * `tab` prop, and the first entry is the one open at first.
   *
   * @default the built-in tabs
   */
  detailsTabs?: DetailsTabDef[] | false

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
   * Trace the path between two selected nodes on its own.
   *
   * With exactly two nodes selected — Shift-click, or `v-model:selection` from
   * outside — the map finds the route between them and highlights it, the same
   * way the imperative `highlightPath` does; selecting anything else clears it.
   * The result also leaves through `path-change`, so an application can show the
   * hops without calling anything.
   *
   * Off by default: a map that traces paths by itself would fight an application
   * that highlights something of its own on selection.
   *
   * @default false
   */
  autoPath?: boolean
  /** Options for the automatic trace; also the defaults for `highlightPath`. */
  pathOptions?: PathOptions

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
  /**
   * Set for the `node-label` slot only: the sublabels the node would have drawn,
   * already narrowed by the view and by `maxSublabels`.
   */
  sublabels?: readonly string[]
  /** Set for the `node-status` slot only: `entity.status` and its resolved color. */
  status?: string
  statusColor?: string
}

/** Parameters of the `details` slot: the body of a details window. */
export interface DetailsSlotProps<E = unknown> {
  entity: AssetEntity<E>
  close: () => void
  /** Id of the active tab. */
  tab: string
}

/** Parameters of the `details-header` slot: the window's heading block. */
export interface DetailsHeaderSlotProps<E = unknown> {
  entity: AssetEntity<E>
  close: () => void
}

/** Parameters of the `details-title` slot: the caption in the window's title bar. */
export interface DetailsTitleSlotProps<E = unknown> {
  entity: AssetEntity<E>
  /** `true` while the window is folded down to its bar. */
  collapsed: boolean
  close: () => void
}

/** Parameters of the `details-tabs` slot: the window's tab strip. */
export interface DetailsTabsSlotProps<E = unknown> {
  entity: AssetEntity<E>
  /** The tabs that would have been drawn — the custom ones, or the built-ins. */
  tabs: readonly DetailsTabDef[]
  /** Id of the open tab; this is what the `#details` slot receives as `tab`. */
  active: string
  select: (id: string) => void
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
  /** Replaces the caption inside `.vam-window__header`, `detailsTitle` included. */
  'details-title'?(props: DetailsTitleSlotProps<E>): unknown
  /** Replaces the whole tab strip. Rendered only while `detailsTabs` is not `false`. */
  'details-tabs'?(props: DetailsTabsSlotProps<E>): unknown
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
  /**
   * Returns the path in original entity ids, or an empty array if there is none.
   *
   * `options` override `pathOptions` for this one call.
   */
  highlightPath: (from: EntityId, to: EntityId, options?: PathOptions) => EntityId[]
  clearHighlight: () => void
  getGraph: () => AssetGraph<E, L>
}
