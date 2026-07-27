<script setup lang="ts" generic="E = unknown, L = unknown">
import { computed, nextTick, onMounted, ref, shallowRef, useSlots, watch, type Slot } from 'vue'
// `ConnectionMode.Loose` lets a drag end on any handle rather than only on one
// typed `target`. The connectors are all sources — a side of a circle is not
// inherently an inbound or an outbound side — so strict mode would let a link
// start anywhere and land nowhere.
import { ConnectionMode, VueFlow, useNodesInitialized, useVueFlow, type NodeDragEvent } from '@vue-flow/core'
import type { EntityId, AssetEntity, XY } from '../types/entity'
import type { CollapsedGroup } from '../types/collapse'
import type { FieldDef } from '../types/field'
import type { FilterState } from '../types/filter'
import type { AssetGraph } from '../types/graph'
import type { AssetLink } from '../types/link'
import type {
  FocusOptions,
  AssetMapExposed,
  AssetMapProps,
  AssetMapSlots,
  NodeEventPayload,
  PathOptions,
  Viewport,
} from '../types/props'
import { useAssetGraph } from '../composables/useAssetGraph'
import { useViewProjection } from '../composables/useViewProjection'
import { useFilters } from '../composables/useFilters'
import { useCollapse } from '../composables/useCollapse'
import { useLayout, type NodeSize } from '../composables/useLayout'
import { useSelection } from '../composables/useSelection'
import { useNodeMarkers } from '../composables/useNodeMarkers'
import { useFlowElements } from '../composables/useFlowElements'
import { provideMapContext, type ArrowDirection, type MapContext } from '../composables/useMapContext'
import DetailsPanel from './panel/DetailsPanel.vue'
import LinkDetailsPanel from './panel/LinkDetailsPanel.vue'
import SearchInput from './controls/SearchInput.vue'
import ViewSwitcher from './controls/ViewSwitcher.vue'
import FilterMenu from './controls/FilterMenu.vue'
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import MapLegend from './MapLegend.vue'
import MiniMap, { type MiniMapNode } from './MiniMap.vue'
import { buildEdgeTypes, buildNodeTypes } from '../registry/nodeRegistry'
import { createTranslator, resolveLocale } from '../locale/index'
import { blastRadius, findPaths, neighbors } from '../core/traverse'
import { resolveTheme } from '../composables/useTheme'

const props = withDefaults(defineProps<AssetMapProps<E, L>>(), {
  showToolbar: true,
  showDetailsPanel: true,
  showMinimap: false,
  showNodeStatus: true,
  showNodeToggle: true,
  showNodeLabel: true,
  showDetailsHeading: true,
  showLegend: false,
  showContextMenu: false,
  editable: false,
  detailsMode: 'replace',
  onlyRenderVisibleElements: true,
  lodThreshold: 0.5,
  loading: false,
  autoFitView: false,
  autoPath: false,
  // Same trap as `collapse`: `DetailsTabDef[] | false` reads as a boolean prop to
  // Vue, so an absent value would be cast to `false` and remove the tab strip
  // from every window instead of leaving the built-in tabs in place.
  detailsTabs: undefined,
  // `collapse` is typed `CollapseRule | false`, so Vue treats it as a boolean
  // prop and casts an absent value to `false`. Without an explicit
  // `default: undefined` collapsing would be off by default — the exact opposite
  // of the intended "a group of more than 10 children is collapsed".
  collapse: undefined,
})

const emit = defineEmits<{
  'node-click': [payload: NodeEventPayload]
  'node-dblclick': [payload: NodeEventPayload]
  'node-context-menu': [payload: NodeEventPayload]
  'edge-click': [payload: { id: string; event: MouseEvent }]
  'pane-click': [event: MouseEvent]
  expand: [payload: { groupId: string; group: CollapsedGroup | undefined }]
  collapse: [payload: { groupId: string; group: CollapsedGroup | undefined }]
  'node-expand': [payload: { id: EntityId; entity: AssetEntity<E> | undefined }]
  'node-collapse': [payload: { id: EntityId; entity: AssetEntity<E> | undefined }]
  'selection-change': [ids: EntityId[]]
  /** The traced path changed: entity ids in order, or empty when it was dropped. */
  'path-change': [ids: EntityId[]]

  /**
   * An edit was saved. The payload is a **new** object — the map never writes to
   * the arrays it was given, so applying it is the application's move.
   */
  'entity-update': [payload: { id: EntityId; entity: AssetEntity<E> }]
  'link-update': [payload: { id: string; link: AssetLink<L> }]
  /** Delete was confirmed. The map has already closed any window showing it. */
  'entity-delete': [payload: { id: EntityId; entity: AssetEntity<E> | undefined }]
  'link-delete': [payload: { id: string; link: AssetLink<L> | undefined }]
  /**
   * A link was drawn between two nodes.
   *
   * `link` is a candidate the map made up, with a generated id: nothing exists
   * until the application puts it in `links`. Its window opens in edit mode
   * regardless, so the kind and speed can be filled in straight away.
   */
  'link-create': [payload: { link: AssetLink<L>; source: EntityId; target: EntityId }]
  'layout-start': [engine: string]
  'layout-done': [payload: { engine: string; positions: number }]
  error: [error: unknown]
}>()

/**
 * Two-way bindings.
 *
 * With a `v-model` attached the state is controlled from outside; without one
 * the ref stays local and the component owns the state itself.
 */
const viewId = defineModel<string | undefined>('view', { default: undefined })
const selection = defineModel<EntityId[]>('selection', { default: () => [] })
const expanded = defineModel<Set<string>>('expanded', { default: () => new Set<string>() })
const filters = defineModel<FilterState>('filters', {
  default: (): FilterState => ({ query: '', types: [], statuses: [] }),
})
const viewport = defineModel<Viewport>('viewport', { default: () => ({ x: 0, y: 0, zoom: 1 }) })
/** Entities with an open details window; the last one is on top. */
const openDetails = defineModel<EntityId[]>('openDetails', { default: () => [] })
/** Links with an open connection window; the last one is on top. */
const openLinks = defineModel<string[]>('openLinks', { default: () => [] })
/** Nodes whose descendants are folded by the button on the node itself. */
const collapsedNodes = defineModel<Set<EntityId>>('collapsedNodes', {
  default: () => new Set<EntityId>(),
})

defineSlots<AssetMapSlots<E, L>>()

const slots = useSlots()

const messages = computed(() => resolveLocale(props.locale))
const t = computed(() => createTranslator(messages.value))

const theme = resolveTheme(computed(() => props.theme))

const { graph } = useAssetGraph<E, L>(
  computed(() => props.entities),
  computed(() => props.links),
)

const { view, projection, showSublabels } = useViewProjection(
  graph,
  computed(() => props.views),
  viewId,
)

const filterState = useFilters(
  graph,
  projection,
  filters,
  computed(() => props.filterOptions),
  computed(() => props.searchDebounce),
)

const collapseState = useCollapse(
  graph,
  // Collapsing follows the view projection, not the filter result: otherwise the
  // set of groups would change on every letter typed and the map would rebuild
  // under the user's hands. The filter only affects visibility and highlighting.
  computed(() => projection.value.entityIds),
  projection,
  computed(() => props.collapse),
  expanded,
  collapsedNodes,
)

/**
 * Node size for layout, in canvas px.
 *
 * A node is a circle plus a fixed-size label plate, so height depends on neither
 * the view nor the number of sublabels: otherwise switching to a view that hides
 * sublabels would resize every node and the layout would jump.
 *
 * The numbers mirror the `--vam-node-*` tokens. Reading them from CSS during
 * layout is not an option: layout also runs without a DOM, in the core tests.
 */
const NODE_LABEL_WIDTH = 127.5
const NODE_LABEL_HEIGHT = 42
const NODE_LABEL_GAP = 6
const NODE_CIRCLE = 36
const NODE_CIRCLE_ROOT = 60

/**
 * Sublabels a node should draw.
 *
 * Three inputs narrow the entity's own list: the view may hide sublabels
 * altogether, a simplified node has no plate to put them on, and `maxSublabels`
 * caps how many lines fit the design. There is no limit of the package's own — an
 * entity with six sublabels draws six.
 */
function sublabelsOf(id: EntityId): readonly string[] {
  if (!showSublabels.value || simplified.value) return []

  const sublabels = graph.value.entities.get(id)?.sublabels
  if (!sublabels || sublabels.length === 0) return []

  const max = props.maxSublabels
  return max === undefined ? sublabels : sublabels.slice(0, Math.max(0, max))
}

function sizeOf(nodeId: string): NodeSize {
  const circle = graph.value.parentOf.get(nodeId) === null ? NODE_CIRCLE_ROOT : NODE_CIRCLE

  return {
    width: NODE_LABEL_WIDTH,
    height: circle + NODE_LABEL_GAP + NODE_LABEL_HEIGHT,
  }
}

const layoutState = useLayout({
  graph,
  collapsed: collapseState.collapsed,
  spec: computed(() => props.layout),
  view,
  sizeOf,
  onStart: (engine) => emit('layout-start', engine),
  onDone: (engine, positions) => emit('layout-done', { engine, positions }),
  onError: (error) => emit('error', error),
})

/**
 * Always builds a new object: `filters` may be controlled from outside through
 * `v-model:filters`, where editing in place would raise no update event — and
 * would mutate an object belonging to the consumer.
 */
function patchFilters(patch: Partial<FilterState>): void {
  filters.value = { ...filters.value, ...patch }
}

const markerState = useNodeMarkers(
  graph,
  computed(() => props.markers),
  computed(() => props.markerHoverDelay),
)

const selectionState = useSelection(selection)

watch(
  () => selection.value,
  (ids) => emit('selection-change', [...ids]),
)

const nodeTypes = computed(() => buildNodeTypes(props.nodeTypes))
const edgeTypes = computed(() => buildEdgeTypes(props.edgeTypes))

/** Declared connection kinds by id, for the edges, the legend and the type select. */
const linkTypeById = computed(() => new Map((props.linkTypes ?? []).map((type) => [type.id, type])))

const { nodes, edges } = useFlowElements({
  graph,
  collapsed: collapseState.collapsed,
  positionOf: layoutState.positionOf,
  filterVisibleIds: computed(() => (filterState.active.value ? filterState.visibleIds.value : undefined)),
  nodeTypes,
  edgeTypes,
  draggable: ref(true),
  connectable: computed(() => props.editable),
})

const {
  fitView: flowFitView,
  setViewport,
  setCenter,
  viewport: flowViewport,
  dimensions: canvasSize,
} = useVueFlow()

/**
 * True once every visible node has a measured size — Vue Flow gets this from a
 * `ResizeObserver` on each node, so it flips back to `false` and then `true`
 * again whenever the set of visible nodes changes, not just once at mount.
 */
const nodesReady = useNodesInitialized()

/**
 * Whether the next "nodes are measured" signal should refit the canvas.
 *
 * `nodesReady` cannot tell the difference between the map appearing and someone
 * unfolding one node's children — both change the visible set. Fitting on the
 * second is what made the whole map jump every time a subtree was expanded, and
 * a viewport that moves on its own while you are working one corner of the graph
 * loses your place. So the intent is recorded here by whatever caused it, and
 * anything not on this list leaves the viewport where the user put it.
 */
const fitRequested = ref(props.autoFitView)

watch(nodesReady, (ready) => {
  if (!ready || !fitRequested.value) return
  fitRequested.value = false
  void fitView()
})

/**
 * A view switch is a different graph, so it does earn a refit — the previous
 * viewport describes a layout that is no longer on screen.
 *
 * It also drops the selection: a node selected in one view need not exist in the
 * next, and a selection you cannot see still dims everything around it.
 */
watch(view, () => {
  if (props.autoFitView) fitRequested.value = true
  selectionState.clear()
  clearHighlight()
})

/** Overview nodes: the visible ones, with positions already computed. */
const minimapNodes = computed<MiniMapNode[]>(() =>
  nodes.value
    .filter((node) => node.hidden !== true)
    .map((node) => {
      const size = sizeOf(node.id)
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: size.width,
        height: size.height,
        matched: filterState.matchedIds.value.has(node.id),
        selected: selectionState.isSelected(node.id),
      }
    }),
)

/** A click on the overview centres the canvas on the point it reports. */
function focusPoint(point: XY): void {
  void setCenter(point.x, point.y, { zoom: flowViewport.value.zoom, duration: 200 })
}

const simplified = computed(() => flowViewport.value.zoom < props.lodThreshold)

/** Two-way viewport sync, guarded against an update loop. */
let syncingViewport = false

watch(flowViewport, (next) => {
  if (syncingViewport) return
  const current = viewport.value
  if (current.x === next.x && current.y === next.y && current.zoom === next.zoom) return
  viewport.value = { x: next.x, y: next.y, zoom: next.zoom }
})

watch(viewport, (next) => {
  const current = flowViewport.value
  if (current.x === next.x && current.y === next.y && current.zoom === next.zoom) return
  syncingViewport = true
  void setViewport(next).finally(() => {
    syncingViewport = false
  })
})

const highlightedNodeIds = shallowRef<ReadonlySet<string>>(new Set())
const highlightedEdgeIds = shallowRef<ReadonlySet<string>>(new Set())

/**
 * Hop limit for a path search.
 *
 * Bounded because `findPaths` walks the graph depth-first: on a dense map an
 * unbounded search is what hangs the tab, and a route longer than this is not
 * something a reader can follow on screen anyway.
 */
const DEFAULT_PATH_DEPTH = 12

/** Last traced path, in original entity ids. Drives `path-change`. */
const tracedPath = shallowRef<readonly EntityId[]>([])

function setTracedPath(path: readonly EntityId[]): void {
  // Guarded rather than emitted unconditionally: with `autoPath` on, the trace is
  // recomputed whenever the graph or the view changes, and most of those runs
  // find the same path as before.
  if (path.length === tracedPath.value.length && path.every((id, index) => tracedPath.value[index] === id)) {
    return
  }
  tracedPath.value = path
  emit('path-change', [...path])
}

function clearHighlight(): void {
  setTracedPath([])
  if (highlightedNodeIds.value.size === 0 && highlightedEdgeIds.value.size === 0) return
  highlightedNodeIds.value = new Set()
  highlightedEdgeIds.value = new Set()
}

/**
 * Highlights a path between two nodes.
 *
 * Searched on the original graph, restricted to the current view's layers, but
 * drawn on the collapsed one: where a stretch of the path is hidden inside a
 * group, the group node and the edges leading to it light up instead — the path
 * would otherwise appear to break off.
 */
function highlightPath(from: EntityId, to: EntityId, options?: PathOptions): EntityId[] {
  const resolved = { ...props.pathOptions, ...options }
  const layers = resolved.layers ?? (view.value ? [view.value.id] : undefined)
  const paths = findPaths(graph.value, from, to, {
    maxPaths: 1,
    maxDepth: resolved.maxDepth ?? DEFAULT_PATH_DEPTH,
    ...(layers ? { layers } : {}),
  })

  const path = paths[0]
  if (!path) {
    clearHighlight()
    return []
  }

  const groupOf = collapseState.collapsed.value.groupOf
  const visualPath = path.map((id) => groupOf.get(id) ?? id)
  const nodeIds = new Set(visualPath)

  const edgeIds = new Set<string>()
  for (const link of collapseState.collapsed.value.links) {
    for (let index = 0; index < visualPath.length - 1; index += 1) {
      const a = visualPath[index]
      const b = visualPath[index + 1]
      if (a === undefined || b === undefined || a === b) continue
      const matches = (link.source === a && link.target === b) || (link.source === b && link.target === a)
      if (matches) edgeIds.add(link.id)
    }
  }

  highlightedNodeIds.value = nodeIds
  highlightedEdgeIds.value = edgeIds
  setTracedPath(path)
  return path
}

const nodeElements = new Map<string, HTMLElement>()

function payloadFor(id: string, event: MouseEvent): NodeEventPayload {
  return {
    id,
    entity: graph.value.entities.get(id),
    group: collapseState.groupById.value.get(id),
    event,
  }
}

function onNodeClick(id: string, event: MouseEvent): void {
  // Shift is the primary additive modifier, not just a fallback: on macOS,
  // Ctrl+click is the system's own right-click emulation and is dispatched as
  // `contextmenu` instead of `click` in most browsers, so a handler keyed only
  // on `ctrlKey`/`metaKey` would never see it. Ctrl/Cmd are still honoured for
  // whoever's muscle memory expects them, but Shift is the one that always works.
  const additive = event.shiftKey || event.ctrlKey || event.metaKey

  selectionState.toggle(id, additive)

  // A modified click only builds up a selection: someone picking a second node to
  // trace a path to does not want a window over the map for every node they
  // touch, and by the time the pair is chosen the windows would be in the way of
  // the very path they asked for. A plain click still opens one.
  // A group node never gets a window either — there is no entity behind it.
  if (!additive && graph.value.entities.has(id)) openDetail(id)

  emit('node-click', payloadFor(id, event))
}

function onNodeDoubleClick(id: string, event: MouseEvent): void {
  emit('node-dblclick', payloadFor(id, event))
}

function onNodeContextMenu(id: string, event: MouseEvent): void {
  if (props.showContextMenu) openMenu('node', id, event)
  emit('node-context-menu', payloadFor(id, event))
}

function onEdgeContextMenu(id: string, event: MouseEvent): void {
  if (props.showContextMenu) openMenu('link', id, event)
}

function onGroupToggle(groupId: string): void {
  const group = collapseState.groupById.value.get(groupId)
  const nowExpanded = collapseState.toggle(groupId)
  if (nowExpanded) emit('expand', { groupId, group })
  else emit('collapse', { groupId, group })
}

function onEdgeClick(id: string, event: MouseEvent): void {
  // An aggregated edge stands for several links at once and has no single
  // record to describe, so it opens no window — the click still reports.
  if (linkById.value.has(id)) openLink(id)
  emit('edge-click', { id, event })
}

/** The button on a node itself: folds its subtree away and back. */
function onToggleSubtree(id: EntityId): void {
  const entity = graph.value.entities.get(id)
  const collapsedNow = collapseState.toggleSubtree(id)
  if (collapsedNow) emit('node-collapse', { id, entity })
  else emit('node-expand', { id, entity })
}

function onPaneClick(event: MouseEvent): void {
  selectionState.clear()
  clearHighlight()
  emit('pane-click', event)
}

/** A dragged position outranks everything; a relayout will not reset it. */
function onNodeDragStop(event: NodeDragEvent): void {
  for (const node of event.nodes) {
    layoutState.setManualPosition(node.id, { x: node.position.x, y: node.position.y })
  }
}

const ARROW_VECTORS: Readonly<Record<ArrowDirection, XY>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * Moves to a neighbour with the arrow keys.
 *
 * Of all neighbours in the collapsed graph it picks the one whose direction is
 * closest to the arrow's, and only within a half-circle — otherwise "up" could
 * take you to a node that sits to the side, or below.
 */
function onArrowNavigate(id: string, direction: ArrowDirection): void {
  const origin = layoutState.positionOf(id)
  if (!origin) return

  const vector = ARROW_VECTORS[direction]
  let best: string | undefined
  let bestScore = 0

  for (const link of collapseState.collapsed.value.links) {
    const neighborId = link.source === id ? link.target : link.target === id ? link.source : undefined
    if (neighborId === undefined) continue

    const target = layoutState.positionOf(neighborId)
    if (!target) continue

    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const length = Math.hypot(dx, dy)
    if (length === 0) continue

    // Cosine of the angle between the arrow direction and the neighbour.
    const alignment = (dx * vector.x + dy * vector.y) / length
    if (alignment <= 0.35) continue

    if (alignment > bestScore) {
      bestScore = alignment
      best = neighborId
    }
  }

  if (best !== undefined) nodeElements.get(best)?.focus()
}

function onRootKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  // Escape closes the topmost window rather than clearing the selection: the
  // windows are what covers the map, so they are what the user wants gone first.
  // One per press — closing them all at once is too blunt.
  const topmost = openDetails.value.at(-1)
  if (topmost !== undefined) closeDetail(topmost)
}

/**
 * Which filter lists are expanded.
 *
 * Component state, not `localStorage`: the package never writes to browser
 * storage. It leaves through `v-model:openFilterGroups` — persisting it across
 * sessions is the application's decision.
 */
const openFilterGroups = defineModel<string[] | undefined>('openFilterGroups', {
  default: undefined,
})

const maxDetailWindows = computed(() => Math.max(0, props.maxDetailsWindows ?? 2))

const windowsLayer = ref<HTMLElement>()

/** The canvas box, for placing a context menu in canvas coordinates. */
const canvasElement = ref<HTMLElement>()

/** Height taken by the consumer's own windows at the top of their layer, in px. */
const customWindowsHeight = ref(0)

/**
 * A custom window counts as occupying the top only while its own top edge is
 * within this band of the layer edge, in px. One dragged to the middle of the
 * canvas must not keep pushing the details windows down.
 */
const TOP_BAND_PX = 24

function measureCustomWindows(): void {
  const layer = windowsLayer.value
  if (!layer) {
    customWindowsHeight.value = 0
    return
  }

  const layerTop = layer.getBoundingClientRect().top
  let occupied = 0
  for (const child of layer.children) {
    const rect = child.getBoundingClientRect()
    if (rect.height === 0) continue
    if (rect.top - layerTop > TOP_BAND_PX) continue
    occupied = Math.max(occupied, rect.bottom - layerTop)
  }

  customWindowsHeight.value = occupied
}

// Measured at start-up and before a window opens: that is when the space
// already taken up top has to be known.
onMounted(measureCustomWindows)
watch(openDetails, () => void nextTick(measureCustomWindows))

/**
 * Top offsets for the floating windows.
 *
 * `--vam-windows-top` drops the windows below the toolbar when its right slot has
 * anything in it: the map's own controls sit on the left, which a right-aligned
 * window already clears, but application buttons from `#toolbar-right` would be
 * covered and become unclickable.
 *
 * `--vam-details-top` drops the details windows further, below the consumer's own
 * windows, so a newly opened one does not cover, say, a history strip.
 */
const canvasStyle = computed<Record<string, string> | undefined>(() => {
  const style: Record<string, string> = {}

  if (props.showToolbar && slots['toolbar-right']) {
    style['--vam-windows-top'] = 'calc(var(--vam-space-3) + var(--vam-toolbar-height) + var(--vam-space-2))'
  }

  if (customWindowsHeight.value > 0) {
    style['--vam-details-top'] =
      `calc(var(--vam-windows-top) + ${customWindowsHeight.value}px + var(--vam-space-2))`
  }

  return Object.keys(style).length > 0 ? style : undefined
})

/**
 * Opens a window for an entity.
 *
 * An already open window is raised rather than duplicated. In `'replace'` mode
 * a plain click swaps whatever was open for this node, so clicking around the
 * map reads one node at a time instead of burying it under windows; `newWindow`
 * is the context menu asking for another one regardless. Once the limit is
 * reached the oldest closes — silently ignoring the click would be worse, as the
 * user would read it as the map not responding.
 */
function openDetail(id: EntityId, options?: { newWindow?: boolean }): void {
  if (!props.showDetailsPanel || maxDetailWindows.value === 0) return

  const stacking = options?.newWindow === true || props.detailsMode === 'stack'

  if (!stacking) {
    // Already the only window open: nothing to do, and reassigning would reset
    // the window's dragged position for no reason.
    if (openDetails.value.length === 1 && openDetails.value[0] === id) return
    openDetails.value = [id]
    return
  }

  const rest = openDetails.value.filter((candidate) => candidate !== id)
  const next = [...rest, id]
  openDetails.value =
    next.length > maxDetailWindows.value ? next.slice(next.length - maxDetailWindows.value) : next
}

function closeDetail(id: EntityId): void {
  if (!openDetails.value.includes(id)) return
  openDetails.value = openDetails.value.filter((candidate) => candidate !== id)
}

/** Links by id, for the windows and the menus. Aggregated edges are absent. */
const linkById = computed(() => graph.value.links)

/**
 * Opens a connection window.
 *
 * Follows `detailsMode` the same way entity windows do, and shares the same cap:
 * the two kinds of window sit in the same corner and compete for the same space.
 */
function openLink(id: string, options?: { newWindow?: boolean }): void {
  if (!props.showDetailsPanel || maxDetailWindows.value === 0) return

  const stacking = options?.newWindow === true || props.detailsMode === 'stack'

  if (!stacking) {
    if (openLinks.value.length === 1 && openLinks.value[0] === id) return
    openLinks.value = [id]
    return
  }

  const rest = openLinks.value.filter((candidate) => candidate !== id)
  const next = [...rest, id]
  openLinks.value =
    next.length > maxDetailWindows.value ? next.slice(next.length - maxDetailWindows.value) : next
}

function closeLink(id: string): void {
  if (!openLinks.value.includes(id)) return
  openLinks.value = openLinks.value.filter((candidate) => candidate !== id)
  // A link abandoned before its first save leaves with its window: it was never
  // in the data, and keeping the id around would reopen an empty form later.
  if (pendingLinkId.value === id) pendingLinkId.value = undefined
}

/**
 * Caption for a window's title bar.
 *
 * `undefined` leaves the window to fall back to `entity.label`, which is also
 * what a function returning nothing usable means.
 */
function detailsTitleOf(entity: AssetEntity<E>): string | undefined {
  const title = props.detailsTitle
  if (title === undefined) return undefined
  return typeof title === 'function' ? title(entity) : title
}

/** Entities of the open windows; ones that leave the data drop out by themselves. */
const detailWindows = computed(() =>
  openDetails.value
    .map((id) => graph.value.entities.get(id))
    .filter((entity): entity is AssetEntity<E> => entity !== undefined),
)

/**
 * Links of the open connection windows.
 *
 * A link drawn but not yet accepted by the application is not in the graph, so
 * it is carried separately until it either arrives in `links` or is abandoned.
 */
const linkWindows = computed<AssetLink<L>[]>(() =>
  openLinks.value
    .map((id) => graph.value.links.get(id) ?? (pendingLinkId.value === id ? pendingLink.value : undefined))
    .filter((link): link is AssetLink<L> => link !== undefined),
)

/* ------------------------------------------------------------------ menus -- */

type MenuTarget = { kind: 'node' | 'link'; id: string; x: number; y: number }

const menu = shallowRef<MenuTarget | undefined>(undefined)

function openMenu(kind: 'node' | 'link', id: string, event: MouseEvent): void {
  // Suppressing the browser menu is only justified once ours is actually going
  // to appear, which is why this sits here and not in the node component.
  event.preventDefault()
  event.stopPropagation()

  const bounds = canvasElement.value?.getBoundingClientRect()
  menu.value = {
    kind,
    id,
    // Canvas-relative: the menu is positioned inside the canvas, so it stays
    // put if the page scrolls under it.
    x: event.clientX - (bounds?.left ?? 0),
    y: event.clientY - (bounds?.top ?? 0),
  }
}

function closeMenu(): void {
  menu.value = undefined
}

/** Rows of the open menu, resolved against what the target actually is. */
const menuItems = computed<ContextMenuItem[]>(() => {
  const target = menu.value
  if (!target) return []

  if (target.kind === 'node') {
    // A group node has no entity behind it, so neither item applies to it.
    if (!graph.value.entities.has(target.id)) return []
    const items: ContextMenuItem[] = [{ id: 'open-new', label: t.value('menu.openInNewWindow') }]
    if (props.editable) items.push({ id: 'delete', label: t.value('menu.delete'), danger: true })
    return items
  }

  const items: ContextMenuItem[] = [{ id: 'open-new', label: t.value('menu.openDetails') }]
  if (props.editable) items.push({ id: 'delete', label: t.value('menu.deleteLink'), danger: true })
  return items
})

function onMenuSelect(action: string): void {
  const target = menu.value
  closeMenu()
  if (!target) return

  if (action === 'open-new') {
    if (target.kind === 'node') openDetail(target.id, { newWindow: true })
    else openLink(target.id, { newWindow: true })
    return
  }

  if (action === 'delete') confirming.value = { kind: target.kind, id: target.id }
}

/* --------------------------------------------------------------- deleting -- */

const confirming = shallowRef<{ kind: 'node' | 'link'; id: string } | undefined>(undefined)

const confirmText = computed(() => {
  const target = confirming.value
  if (!target) return undefined

  if (target.kind === 'node') {
    const entity = graph.value.entities.get(target.id)
    return {
      title: t.value('confirm.deleteEntity.title'),
      body: t.value('confirm.deleteEntity.body', { label: entity?.label ?? target.id }),
    }
  }

  const link = graph.value.links.get(target.id)
  return {
    title: t.value('confirm.deleteLink.title'),
    body: t.value('confirm.deleteLink.body', {
      source: graph.value.entities.get(link?.source ?? '')?.label ?? link?.source ?? '—',
      target: graph.value.entities.get(link?.target ?? '')?.label ?? link?.target ?? '—',
    }),
  }
})

function onConfirmDelete(): void {
  const target = confirming.value
  confirming.value = undefined
  if (!target) return

  if (target.kind === 'node') {
    // Its window goes first: leaving one open over a node that no longer exists
    // would show a record the application has just been told to drop.
    closeDetail(target.id)
    selectionState.deselect(target.id)
    emit('entity-delete', { id: target.id, entity: graph.value.entities.get(target.id) })
    return
  }

  closeLink(target.id)
  emit('link-delete', { id: target.id, link: graph.value.links.get(target.id) })
}

/* ---------------------------------------------------------------- editing -- */

/**
 * Link fields offered when the consumer declares none.
 *
 * Type, label and speed: the shape almost every link has. The type is a select
 * over the declared `linkTypes`, so the two features stay in step without the
 * consumer wiring them together.
 */
const resolvedLinkFields = computed<FieldDef[]>(() => {
  // `editable` gates first: declaring fields describes a form, it does not ask
  // for one. Without it there is no edit button, however many fields are named.
  if (!props.editable) return []
  if (props.linkFields) return props.linkFields

  return [
    {
      key: 'type',
      label: t.value('link.type'),
      type: 'select',
      options: (props.linkTypes ?? []).map((type) => ({ value: type.id, label: type.label ?? type.id })),
    },
    { key: 'label', label: t.value('details.title') },
    { key: 'meta.speed', label: t.value('link.speed') },
  ]
})

/**
 * Entity fields offered when the consumer declares none.
 *
 * The same courtesy links get: `editable` on its own is enough to put a working
 * Edit button on both windows, instead of one kind of record being editable out
 * of the box and the other silently not.
 *
 * Only the two fields the package actually knows the meaning of. `status` is a
 * select over the statuses the consumer already named in
 * `themeConfig.statusColors`, and falls back to free text when they named none —
 * offering an empty dropdown would be worse than offering a box to type in.
 * Anything in `meta` needs `entityFields`, since the package cannot guess either
 * the names or which of them matter.
 */
const entityFields = computed<FieldDef[]>(() => {
  if (!props.editable) return []
  if (props.entityFields) return props.entityFields

  const statuses = Object.keys(props.themeConfig?.statusColors ?? {})

  return [
    { key: 'label', label: t.value('details.title') },
    {
      key: 'status',
      label: t.value('details.status'),
      ...(statuses.length > 0
        ? { type: 'select' as const, options: statuses.map((status) => ({ value: status })) }
        : {}),
    },
  ]
})

function onEntitySave(entity: AssetEntity<E>): void {
  emit('entity-update', { id: entity.id, entity })
}

function onLinkSave(link: AssetLink<L>): void {
  // The first save of a drawn link is what brings it into being; after that it
  // is an ordinary update and the map stops carrying it.
  if (pendingLinkId.value === link.id) {
    pendingLinkId.value = undefined
    pendingLink.value = undefined
    emit('link-create', { link, source: link.source, target: link.target })
    return
  }
  emit('link-update', { id: link.id, link })
}

/* --------------------------------------------------------- drawing a link -- */

/** A link drawn on the canvas but not yet accepted into `links`. */
const pendingLink = shallowRef<AssetLink<L> | undefined>(undefined)
const pendingLinkId = shallowRef<string | undefined>(undefined)

/**
 * Vue Flow reports a completed drag between two handles.
 *
 * The candidate is given the current view's layer so it is visible in the view
 * it was drawn in — a new link that immediately disappears because it belongs to
 * no layer is the obvious trap here.
 */
function onConnect(connection: { source?: string | null; target?: string | null }): void {
  const { source, target } = connection
  if (!source || !target || source === target) return

  const id = `vam-link-${source}-${target}-${Date.now()}`
  const link = {
    id,
    source,
    target,
    layers: view.value ? [view.value.id] : [],
  } as AssetLink<L>

  pendingLink.value = link
  pendingLinkId.value = id
  openLink(id, { newWindow: true })
}

/** A hidden node resolves to whatever hides it: a group or a collapsed parent. */
const resolveVisual = (id: EntityId): string => collapseState.collapsed.value.groupOf.get(id) ?? id

/** Layers of the current view: traversals must follow the links on screen. */
const activeLayers = computed(() => (view.value ? [view.value.id] : undefined))

/**
 * Traces the path between two selected nodes on its own, while `autoPath` is on.
 *
 * Re-runs on a layer or collapse change as well as on the selection: the route
 * depends on which links the current view keeps, and the highlight is drawn on
 * the collapsed graph, so a group folding shut moves it. Anything other than
 * exactly two selected nodes means there is no pair to connect and the highlight
 * goes away — the moment a third node joins the selection included.
 */
watch(
  [selection, () => props.autoPath, activeLayers, () => collapseState.collapsed.value],
  ([ids, enabled]) => {
    if (!enabled) return
    const [from, to] = ids
    if (ids.length !== 2 || from === undefined || to === undefined) {
      clearHighlight()
      return
    }
    highlightPath(from, to)
  },
  { immediate: true },
)

/**
 * Nodes that stay lit while something is selected: the selection and its links.
 *
 * With nothing selected the set is empty and nothing is dimmed — the mode is
 * switched on by the act of selecting.
 */
const selectionFocusIds = computed<ReadonlySet<string>>(() => {
  const depth = props.neighborHighlightDepth ?? 1
  if (depth <= 0 || selection.value.length === 0) return new Set()

  const focus = new Set<string>()
  for (const id of selection.value) {
    focus.add(resolveVisual(id))
    for (const neighbor of neighbors(graph.value, id, depth, activeLayers.value)) {
      focus.add(resolveVisual(neighbor))
    }
  }
  return focus
})

const selectionFocusActive = computed(() => selectionFocusIds.value.size > 0)

/** The marked entities plus everything they capture. */
const infectedIds = computed<ReadonlySet<EntityId>>(() => {
  const marked = props.infected
  if (!marked || marked.length === 0) return new Set()

  const options = props.infectionOptions
  const layers = options?.layers ?? activeLayers.value
  const spread = new Set<EntityId>()

  for (const id of marked) {
    for (const affected of blastRadius(graph.value, id, {
      direction: options?.direction ?? 'downstream',
      ...(options?.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {}),
      ...(layers ? { layers } : {}),
    })) {
      spread.add(affected)
    }
  }
  return spread
})

const infectedVisualIds = computed<ReadonlySet<string>>(() => {
  const visual = new Set<string>()
  for (const id of infectedIds.value) visual.add(resolveVisual(id))
  return visual
})

const infectionSourceIds = computed<ReadonlySet<string>>(() => {
  const sources = new Set<string>()
  for (const id of props.infected ?? []) sources.add(resolveVisual(id))
  return sources
})

/**
 * An edge counts as infected only when both of its ends are.
 *
 * One infected end means the spread did not reach across it — direction or layer
 * did not allow it — so colouring it would mark the very link the capture did
 * **not** travel along.
 */
const infectedEdgeIds = computed<ReadonlySet<string>>(() => {
  const edges = new Set<string>()
  if (infectedVisualIds.value.size === 0) return edges

  for (const link of collapseState.collapsed.value.links) {
    if (infectedVisualIds.value.has(link.source) && infectedVisualIds.value.has(link.target)) {
      edges.add(link.id)
    }
  }
  return edges
})

/** The hovered marker's members, mapped onto collapsed-graph node ids. */
const markerFocusIds = computed<ReadonlySet<string>>(() => {
  if (markerState.hoveredMarker.value === undefined) return new Set()
  const focus = new Set<string>()
  for (const id of markerState.memberIds.value) focus.add(resolveVisual(id))
  return focus
})

const markerFocusActive = computed(() => markerState.hoveredMarker.value !== undefined)

const dimmedNode = (id: string): boolean => {
  // Priority order. Hovering a dot is the most recent and shortest-lived action,
  // so while the pointer rests on one, membership is what gets shown. Then
  // search: while a filter is active it decides what is visible. Selection comes
  // last, since it outlives both.
  if (markerFocusActive.value) return !markerFocusIds.value.has(id)
  if (filterState.active.value) return !filterState.matchedIds.value.has(id)
  if (selectionFocusActive.value) return !selectionFocusIds.value.has(id)
  return false
}

const dimmedEdgeIds = computed<ReadonlySet<string>>(() => {
  const edges = new Set<string>()
  const links = collapseState.collapsed.value.links

  if (markerFocusActive.value) {
    for (const link of links) {
      const inside = markerFocusIds.value.has(link.source) && markerFocusIds.value.has(link.target)
      if (!inside) edges.add(link.id)
    }
    return edges
  }

  if (filterState.active.value) {
    const matched = filterState.matchedIds.value
    for (const link of links) {
      // A link dims only when both ends do: one matching end keeps it visible.
      if (!matched.has(link.source) && !matched.has(link.target)) edges.add(link.id)
    }
    return edges
  }

  if (selectionFocusActive.value) {
    for (const link of links) {
      const inside = selectionFocusIds.value.has(link.source) && selectionFocusIds.value.has(link.target)
      if (!inside) edges.add(link.id)
    }
  }

  return edges
})

const context: MapContext = {
  t: (key, params) => t.value(key, params),
  graph,
  showSublabels,
  simplified,
  showNodeStatus: computed(() => props.showNodeStatus),
  showNodeToggle: computed(() => props.showNodeToggle),
  showNodeLabel: computed(() => props.showNodeLabel),
  sublabelsOf,
  // Cast: `defineSlots` narrows `useSlots()` to `AssetMapSlots`, while lookup by
  // an arbitrary name needs an indexable object. This is the only place that
  // widening to `Record` is required.
  slot: (name) => (slots as Record<string, Slot | undefined>)[name],
  statusColorOf: (status) => (status ? props.themeConfig?.statusColors?.[status] : undefined),
  iconFor: (type) => props.themeConfig?.kindIcons?.[type],
  linkTypeOf: (type) => (type ? linkTypeById.value.get(type) : undefined),
  groupById: (groupId) => collapseState.groupById.value.get(groupId),
  entityById: (id) => graph.value.entities.get(id),
  markersFor: markerState.markersFor,
  isMarkerDimmed: (markerId) => {
    const hovered = markerState.hoveredMarker.value
    return hovered !== undefined && hovered !== markerId
  },
  onMarkerEnter: markerState.onMarkerEnter,
  onMarkerLeave: markerState.onMarkerLeave,
  onMarkerFocus: markerState.onMarkerFocus,
  isRootNode: (id) => graph.value.parentOf.get(id) === null,
  hasChildren: (id) => (graph.value.childrenOf.get(id)?.length ?? 0) > 0,
  isSubtreeCollapsed: (id) => collapseState.isSubtreeCollapsed(id),
  onToggleSubtree,
  isSelected: (id) => selectionState.isSelected(id),
  isMatched: (id) => filterState.matchedIds.value.has(id),
  isDimmed: dimmedNode,
  isHighlighted: (id) => highlightedNodeIds.value.has(id),
  isEdgeHighlighted: (edgeId) => highlightedEdgeIds.value.has(edgeId),
  isEdgeDimmed: (edgeId) => dimmedEdgeIds.value.has(edgeId),
  isInfected: (id) => infectedVisualIds.value.has(id),
  isInfectionSource: (id) => infectionSourceIds.value.has(id),
  isEdgeInfected: (edgeId) => infectedEdgeIds.value.has(edgeId),
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onGroupToggle,
  onEdgeClick,
  onEdgeContextMenu,
  onArrowNavigate,
  registerNodeElement: (id, element) => {
    if (element) nodeElements.set(id, element)
    else nodeElements.delete(id)
  },
}

provideMapContext(context)

const isEmpty = computed(() => nodes.value.every((node) => node.hidden === true))

async function fitView(): Promise<void> {
  await flowFitView({ padding: 0.2 })
}

async function focus(id: EntityId, options?: FocusOptions): Promise<void> {
  const position = layoutState.positionOf(id)
  if (!position) return

  if (options?.select !== false) selectionState.select(id)

  const size = sizeOf(id)
  await setCenter(position.x + size.width / 2, position.y + size.height / 2, {
    zoom: options?.zoom ?? flowViewport.value.zoom,
    duration: options?.duration ?? 400,
  })
}

defineExpose({
  fitView,
  focus,
  relayout: (): Promise<void> => layoutState.relayout(),
  highlightPath,
  clearHighlight,
  getGraph: (): AssetGraph<E, L> => graph.value,
} satisfies AssetMapExposed<E, L>)
</script>

<template>
  <div :class="['vam-root', `vam-theme-${theme}`]" @keydown="onRootKeydown">
    <div class="vam-body">
      <div
        ref="canvasElement"
        class="vam-canvas"
        role="application"
        :aria-label="t('canvas.label')"
        :style="canvasStyle"
      >
        <!-- The toolbar floats over the canvas with no background of its own;
             only the controls carry one, so the map loses no vertical space. -->
        <div v-if="showToolbar" class="vam-toolbar">
          <div class="vam-toolbar__group">
            <slot name="toolbar-left" />

            <FilterMenu
              :model-value="filters"
              :facets="filterState.facets.value"
              :groups="filterOptions?.groups"
              :open-groups="openFilterGroups"
              @update:model-value="filters = $event"
              @update:open-groups="openFilterGroups = $event"
            />

            <div class="vam-toolbar__search">
              <SearchInput
                :model-value="filters.query"
                :result-count="filterState.matchedIds.value.size"
                @update:model-value="patchFilters({ query: $event })"
              />
            </div>

            <!-- Nothing to switch with a single view, and toolbar space is finite. -->
            <ViewSwitcher
              v-if="views && views.length > 1"
              :model-value="viewId"
              :views="views"
              @update:model-value="viewId = $event"
            />
          </div>

          <div class="vam-toolbar__group vam-toolbar__group--end">
            <slot name="toolbar-right" />
          </div>
        </div>

        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :only-render-visible-elements="onlyRenderVisibleElements"
          :nodes-draggable="true"
          :nodes-connectable="editable"
          :connection-mode="ConnectionMode.Loose"
          :elements-selectable="false"
          :min-zoom="0.1"
          :max-zoom="2.5"
          :default-viewport="viewport"
          @node-drag-stop="onNodeDragStop"
          @pane-click="onPaneClick"
          @connect="onConnect"
        />

        <MapLegend v-if="showLegend && linkTypes" :types="linkTypes" />

        <MiniMap
          v-if="showMinimap"
          :nodes="minimapNodes"
          :viewport="{ x: flowViewport.x, y: flowViewport.y, zoom: flowViewport.zoom }"
          :canvas="{ width: canvasSize.width, height: canvasSize.height }"
          @move="focusPoint"
        />

        <div v-if="loading" class="vam-overlay" role="status">
          <slot name="loading">{{ t('canvas.loading') }}</slot>
        </div>

        <div v-else-if="isEmpty" class="vam-overlay">
          <slot name="empty">{{ t('canvas.empty') }}</slot>
        </div>

        <!-- The window pulls the `details` and `details-header` slots out of the
             map context itself: forwarding them by hand would need a `v-if` on
             each, or an empty slot would shadow the default rendering. -->
        <DetailsPanel
          v-for="(entity, index) in detailWindows"
          :key="entity.id"
          :entity="entity"
          :offset="{ x: index * -24, y: index * 24 }"
          :style="{ zIndex: 20 + index }"
          :title="detailsTitleOf(entity)"
          :show-heading="showDetailsHeading"
          :tabs="detailsTabs"
          :fields="entityFields"
          @close="closeDetail(entity.id)"
          @save="onEntitySave($event as AssetEntity<E>)"
        />

        <!-- Connection windows are offset past the entity ones, so opening a
             link while a node is open does not bury it. -->
        <LinkDetailsPanel
          v-for="(link, index) in linkWindows"
          :key="link.id"
          :link="link"
          :offset="{ x: (detailWindows.length + index) * -24, y: (detailWindows.length + index) * 24 }"
          :style="{ zIndex: 20 + detailWindows.length + index }"
          :fields="resolvedLinkFields"
          :start-editing="link.id === pendingLinkId"
          @close="closeLink(link.id)"
          @save="onLinkSave($event as AssetLink<L>)"
        />

        <!-- Consumer windows, above the details windows. The wrapper does not
             capture the pointer, so the canvas stays draggable between them. -->
        <div v-if="slots.windows" ref="windowsLayer" class="vam-windows">
          <slot name="windows" />
        </div>

        <ContextMenu
          v-if="menu && menuItems.length > 0"
          :x="menu.x"
          :y="menu.y"
          :items="menuItems"
          :aria-label="t('details.title')"
          @select="onMenuSelect"
          @close="closeMenu"
        />

        <ConfirmDialog
          v-if="confirming && confirmText"
          :title="confirmText.title"
          :body="confirmText.body"
          @confirm="onConfirmDelete"
          @cancel="confirming = undefined"
        />
      </div>
    </div>
  </div>
</template>

<style>
/* Tokens and themes are pulled in here rather than imported from JS.
 *
 * Reason: an `import './style.css'` inside a published ESM module breaks loading
 * the package in plain Node (SSR without a bundler). A CSS `@import`, by
 * contrast, is inlined by Vite at build time, so the tokens end up in
 * `dist/style.css` — without it a consumer would get components whose every
 * var(--vam-*) is undefined.
 *
 * It lives in this component specifically: it renders `.vam-root`, and the
 * tokens are declared on exactly that class. */
@import '../theme/index.css';

.vam-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--vam-bg);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  line-height: var(--vam-line-height);
  /* The map never shows scrollbars: everything above the canvas — toolbar,
     filter panel, details window — is absolutely positioned and may briefly
     exceed the bounds while opening. Without clipping that would flash a
     scrollbar on both the map and the page. */
  overflow: hidden;
}

/* The toolbar sits over the canvas with no background of its own; only the
   controls have one. `pointer-events` are handed back to the controls so the
   canvas can still be dragged in the gaps between them. */
.vam-toolbar {
  position: absolute;
  z-index: 10;
  top: var(--vam-space-3);
  right: var(--vam-space-3);
  left: var(--vam-space-3);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--vam-space-3);
  pointer-events: none;
}

.vam-toolbar__group {
  display: flex;
  align-items: center;
  gap: var(--vam-space-1);
  min-width: 0;
}

.vam-toolbar__group > * {
  pointer-events: auto;
}

.vam-toolbar__group--end {
  justify-content: flex-end;
}

/* The search field is the only control with a fixed width in the design. */
.vam-toolbar__search {
  display: flex;
  width: 350px;
  max-width: 100%;
  align-items: center;
  height: var(--vam-toolbar-height);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
}

.vam-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.vam-canvas {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  background-color: var(--vam-bg);
  /* Canvas dot grid drawn as a background, avoiding @vue-flow/background. */
  background-image: radial-gradient(var(--vam-canvas-dot) var(--vam-canvas-dot-size), transparent 0);
  background-size: var(--vam-canvas-grid) var(--vam-canvas-grid);
}

.vam-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vam-fg-muted);
  pointer-events: none;
}

/* Layer for the consumer's windows. The layer itself is transparent to the
   pointer while the windows inside are not, or it would cover the whole canvas. */
.vam-windows {
  position: absolute;
  z-index: 40;
  /* Starts where the details windows do: consumer windows must not cover the
     toolbar buttons either. */
  inset: var(--vam-windows-top) 0 0 0;
  pointer-events: none;
}

.vam-windows > * {
  pointer-events: auto;
}

/* VueFlow wraps every node in an element of its own; strip its borders. */
.vam-canvas .vue-flow__node {
  border: 0;
  background: transparent;
  font-family: var(--vam-font);
}
</style>
