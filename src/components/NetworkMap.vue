<script setup lang="ts" generic="E = unknown, L = unknown">
import { computed, nextTick, onMounted, ref, shallowRef, useSlots, watch, type Slot } from 'vue'
import { VueFlow, useVueFlow, type NodeDragEvent } from '@vue-flow/core'
import type { EntityId, NetworkEntity, XY } from '../types/entity'
import type { CollapsedGroup } from '../types/collapse'
import type { FilterState } from '../types/filter'
import type { NetworkGraph } from '../types/graph'
import type {
  FocusOptions,
  NetworkMapExposed,
  NetworkMapProps,
  NetworkMapSlots,
  NodeEventPayload,
  Viewport,
} from '../types/props'
import { useNetworkGraph } from '../composables/useNetworkGraph'
import { useViewProjection } from '../composables/useViewProjection'
import { useFilters } from '../composables/useFilters'
import { useCollapse } from '../composables/useCollapse'
import { useLayout, type NodeSize } from '../composables/useLayout'
import { useSelection } from '../composables/useSelection'
import { useNodeMarkers } from '../composables/useNodeMarkers'
import { useFlowElements } from '../composables/useFlowElements'
import { provideMapContext, type ArrowDirection, type MapContext } from '../composables/useMapContext'
import DetailsPanel from './panel/DetailsPanel.vue'
import SearchInput from './controls/SearchInput.vue'
import ViewSwitcher from './controls/ViewSwitcher.vue'
import FilterMenu from './controls/FilterMenu.vue'
import MiniMap, { type MiniMapNode } from './MiniMap.vue'
import { buildEdgeTypes, buildNodeTypes } from '../registry/nodeRegistry'
import { createTranslator, resolveLocale } from '../locale/index'
import { blastRadius, findPaths, neighbors } from '../core/traverse'
import { resolveTheme } from '../composables/useTheme'

const props = withDefaults(defineProps<NetworkMapProps<E, L>>(), {
  showToolbar: true,
  showDetailsPanel: true,
  showMinimap: false,
  onlyRenderVisibleElements: true,
  lodThreshold: 0.5,
  loading: false,
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
  'node-expand': [payload: { id: EntityId; entity: NetworkEntity<E> | undefined }]
  'node-collapse': [payload: { id: EntityId; entity: NetworkEntity<E> | undefined }]
  'selection-change': [ids: EntityId[]]
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
  default: (): FilterState => ({ query: '', kinds: [], statuses: [] }),
})
const viewport = defineModel<Viewport>('viewport', { default: () => ({ x: 0, y: 0, zoom: 1 }) })
/** Entities with an open details window; the last one is on top. */
const openDetails = defineModel<EntityId[]>('openDetails', { default: () => [] })
/** Nodes whose descendants are folded by the button on the node itself. */
const collapsedNodes = defineModel<Set<EntityId>>('collapsedNodes', {
  default: () => new Set<EntityId>(),
})

defineSlots<NetworkMapSlots<E, L>>()

const slots = useSlots()

const messages = computed(() => resolveLocale(props.locale))
const t = computed(() => createTranslator(messages.value))

const theme = resolveTheme(computed(() => props.theme))

const { graph } = useNetworkGraph<E, L>(
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
 * The numbers mirror the `--vnm-node-*` tokens. Reading them from CSS during
 * layout is not an option: layout also runs without a DOM, in the core tests.
 */
const NODE_LABEL_WIDTH = 127.5
const NODE_LABEL_HEIGHT = 42
const NODE_LABEL_GAP = 6
const NODE_CIRCLE = 36
const NODE_CIRCLE_ROOT = 60

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

const { nodes, edges } = useFlowElements({
  graph,
  collapsed: collapseState.collapsed,
  positionOf: layoutState.positionOf,
  filterVisibleIds: computed(() => (filterState.active.value ? filterState.visibleIds.value : undefined)),
  nodeTypes,
  edgeTypes,
  draggable: ref(true),
})

const {
  fitView: flowFitView,
  setViewport,
  setCenter,
  viewport: flowViewport,
  dimensions: canvasSize,
} = useVueFlow()

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

function clearHighlight(): void {
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
function highlightPath(from: EntityId, to: EntityId): EntityId[] {
  const layers = view.value ? [view.value.id] : undefined
  const paths = findPaths(graph.value, from, to, {
    maxPaths: 1,
    maxDepth: 12,
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
  selectionState.toggle(id, event.ctrlKey || event.metaKey)
  // A group node gets no details window: a group has no entity behind it.
  if (graph.value.entities.has(id)) openDetail(id)
  emit('node-click', payloadFor(id, event))
}

function onNodeDoubleClick(id: string, event: MouseEvent): void {
  emit('node-dblclick', payloadFor(id, event))
}

function onNodeContextMenu(id: string, event: MouseEvent): void {
  emit('node-context-menu', payloadFor(id, event))
}

function onGroupToggle(groupId: string): void {
  const group = collapseState.groupById.value.get(groupId)
  const nowExpanded = collapseState.toggle(groupId)
  if (nowExpanded) emit('expand', { groupId, group })
  else emit('collapse', { groupId, group })
}

function onEdgeClick(id: string, event: MouseEvent): void {
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
 * `--vnm-windows-top` drops the windows below the toolbar when its right slot has
 * anything in it: the map's own controls sit on the left, which a right-aligned
 * window already clears, but application buttons from `#toolbar-right` would be
 * covered and become unclickable.
 *
 * `--vnm-details-top` drops the details windows further, below the consumer's own
 * windows, so a newly opened one does not cover, say, a history strip.
 */
const canvasStyle = computed<Record<string, string> | undefined>(() => {
  const style: Record<string, string> = {}

  if (props.showToolbar && slots['toolbar-right']) {
    style['--vnm-windows-top'] = 'calc(var(--vnm-space-3) + var(--vnm-toolbar-height) + var(--vnm-space-2))'
  }

  if (customWindowsHeight.value > 0) {
    style['--vnm-details-top'] =
      `calc(var(--vnm-windows-top) + ${customWindowsHeight.value}px + var(--vnm-space-2))`
  }

  return Object.keys(style).length > 0 ? style : undefined
})

/**
 * Opens a window for an entity.
 *
 * An already open window is raised rather than duplicated. Once the limit is
 * reached the oldest one closes: silently ignoring the click would be worse, as
 * the user would read it as the map not responding.
 */
function openDetail(id: EntityId): void {
  if (!props.showDetailsPanel || maxDetailWindows.value === 0) return

  const rest = openDetails.value.filter((candidate) => candidate !== id)
  const next = [...rest, id]
  openDetails.value =
    next.length > maxDetailWindows.value ? next.slice(next.length - maxDetailWindows.value) : next
}

function closeDetail(id: EntityId): void {
  if (!openDetails.value.includes(id)) return
  openDetails.value = openDetails.value.filter((candidate) => candidate !== id)
}

/** Entities of the open windows; ones that leave the data drop out by themselves. */
const detailWindows = computed(() =>
  openDetails.value
    .map((id) => graph.value.entities.get(id))
    .filter((entity): entity is NetworkEntity<E> => entity !== undefined),
)

/** A hidden node resolves to whatever hides it: a group or a collapsed parent. */
const resolveVisual = (id: EntityId): string => collapseState.collapsed.value.groupOf.get(id) ?? id

/** Layers of the current view: traversals must follow the links on screen. */
const activeLayers = computed(() => (view.value ? [view.value.id] : undefined))

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
  // Cast: `defineSlots` narrows `useSlots()` to `NetworkMapSlots`, while lookup by
  // an arbitrary name needs an indexable object. This is the only place that
  // widening to `Record` is required.
  slot: (name) => (slots as Record<string, Slot | undefined>)[name],
  statusColorOf: (status) => (status ? props.themeConfig?.statusColors?.[status] : undefined),
  iconFor: (kind) => props.themeConfig?.kindIcons?.[kind],
  groupById: (groupId) => collapseState.groupById.value.get(groupId),
  entityById: (id) => graph.value.entities.get(id),
  markersFor: markerState.markersFor,
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
  getGraph: (): NetworkGraph<E, L> => graph.value,
} satisfies NetworkMapExposed<E, L>)
</script>

<template>
  <div :class="['vnm-root', `vnm-theme-${theme}`]" @keydown="onRootKeydown">
    <div class="vnm-body">
      <div class="vnm-canvas" role="application" :aria-label="t('canvas.label')" :style="canvasStyle">
        <!-- The toolbar floats over the canvas with no background of its own;
             only the controls carry one, so the map loses no vertical space. -->
        <div v-if="showToolbar" class="vnm-toolbar">
          <div class="vnm-toolbar__group">
            <slot name="toolbar-left" />

            <FilterMenu
              :model-value="filters"
              :facets="filterState.facets.value"
              :groups="filterOptions?.groups"
              :open-groups="openFilterGroups"
              @update:model-value="filters = $event"
              @update:open-groups="openFilterGroups = $event"
            />

            <div class="vnm-toolbar__search">
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

          <div class="vnm-toolbar__group vnm-toolbar__group--end">
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
          :nodes-connectable="false"
          :elements-selectable="false"
          :min-zoom="0.1"
          :max-zoom="2.5"
          :default-viewport="viewport"
          @node-drag-stop="onNodeDragStop"
          @pane-click="onPaneClick"
        />

        <MiniMap
          v-if="showMinimap"
          :nodes="minimapNodes"
          :viewport="{ x: flowViewport.x, y: flowViewport.y, zoom: flowViewport.zoom }"
          :canvas="{ width: canvasSize.width, height: canvasSize.height }"
          @move="focusPoint"
        />

        <div v-if="loading" class="vnm-overlay" role="status">
          <slot name="loading">{{ t('canvas.loading') }}</slot>
        </div>

        <div v-else-if="isEmpty" class="vnm-overlay">
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
          @close="closeDetail(entity.id)"
        />

        <!-- Consumer windows, above the details windows. The wrapper does not
             capture the pointer, so the canvas stays draggable between them. -->
        <div v-if="slots.windows" ref="windowsLayer" class="vnm-windows">
          <slot name="windows" />
        </div>
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
 * var(--vnm-*) is undefined.
 *
 * It lives in this component specifically: it renders `.vnm-root`, and the
 * tokens are declared on exactly that class. */
@import '../theme/index.css';

.vnm-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--vnm-bg);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  line-height: var(--vnm-line-height);
  /* The map never shows scrollbars: everything above the canvas — toolbar,
     filter panel, details window — is absolutely positioned and may briefly
     exceed the bounds while opening. Without clipping that would flash a
     scrollbar on both the map and the page. */
  overflow: hidden;
}

/* The toolbar sits over the canvas with no background of its own; only the
   controls have one. `pointer-events` are handed back to the controls so the
   canvas can still be dragged in the gaps between them. */
.vnm-toolbar {
  position: absolute;
  z-index: 10;
  top: var(--vnm-space-3);
  right: var(--vnm-space-3);
  left: var(--vnm-space-3);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--vnm-space-3);
  pointer-events: none;
}

.vnm-toolbar__group {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-1);
  min-width: 0;
}

.vnm-toolbar__group > * {
  pointer-events: auto;
}

.vnm-toolbar__group--end {
  justify-content: flex-end;
}

/* The search field is the only control with a fixed width in the design. */
.vnm-toolbar__search {
  display: flex;
  width: 350px;
  max-width: 100%;
  align-items: center;
  height: var(--vnm-toolbar-height);
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface);
}

.vnm-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.vnm-canvas {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  background-color: var(--vnm-bg);
  /* Canvas dot grid drawn as a background, avoiding @vue-flow/background. */
  background-image: radial-gradient(var(--vnm-canvas-dot) var(--vnm-canvas-dot-size), transparent 0);
  background-size: var(--vnm-canvas-grid) var(--vnm-canvas-grid);
}

.vnm-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vnm-fg-muted);
  pointer-events: none;
}

/* Layer for the consumer's windows. The layer itself is transparent to the
   pointer while the windows inside are not, or it would cover the whole canvas. */
.vnm-windows {
  position: absolute;
  z-index: 40;
  /* Starts where the details windows do: consumer windows must not cover the
     toolbar buttons either. */
  inset: var(--vnm-windows-top) 0 0 0;
  pointer-events: none;
}

.vnm-windows > * {
  pointer-events: auto;
}

/* VueFlow wraps every node in an element of its own; strip its borders. */
.vnm-canvas .vue-flow__node {
  border: 0;
  background: transparent;
  font-family: var(--vnm-font);
}
</style>
