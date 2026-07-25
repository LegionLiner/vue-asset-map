/**
 * Public API of the `vue-asset-map` package.
 *
 * The core is also available on its own subpath, `vue-asset-map/core`, free of
 * both Vue and VueFlow and therefore usable on the server. Styles are imported
 * separately: `import 'vue-asset-map/style.css'`.
 *
 * @packageDocumentation
 */

export * from './core/index'

// `manual` and `radial` are built in; `dagre` lives on the
// `vue-asset-map/layout-dagre` subpath so its optional dependency stays out of
// the main bundle.
export {
  applyPinned,
  builtinLayoutEngines,
  isLayoutAborted,
  LayoutAbortedError,
  manualLayout,
  radialLayout,
  resolveLayoutEngine,
  throwIfAborted,
} from './layout/index'
export type {
  LayoutEngine,
  LayoutGraph,
  LayoutNode,
  ManualLayoutOptions,
  RadialLayoutOptions,
} from './layout/index'

export { default as NetworkMap } from './components/NetworkMap.vue'
export { default as BaseNode } from './components/nodes/BaseNode.vue'
export { default as GroupNode } from './components/nodes/GroupNode.vue'
export { default as NetworkEdge } from './components/edges/NetworkEdge.vue'
export { default as MiniMap } from './components/MiniMap.vue'
// Floating-window chrome: build custom windows for the `#windows` slot from it.
export { default as MapWindow } from './components/MapWindow.vue'
export type { MiniMapNode } from './components/MiniMap.vue'
export { default as DetailsPanel } from './components/panel/DetailsPanel.vue'
export { default as DetailsSection } from './components/panel/DetailsSection.vue'
// The controls also work outside the map: they read the locale from context and
// fall back to the built-in one when there is none.
export { default as SearchInput } from './components/controls/SearchInput.vue'
export { default as ViewSwitcher } from './components/controls/ViewSwitcher.vue'
export { default as FilterMenu } from './components/controls/FilterMenu.vue'

// Node type registry, for assembling a custom set of components.
export {
  buildEdgeTypes,
  buildNodeTypes,
  EDGE_TYPE_BASE,
  edgeTypeFor,
  NODE_TYPE_BASE,
  NODE_TYPE_GROUP,
  nodeTypeFor,
} from './registry/nodeRegistry'

// Composables: the map can also be assembled by hand from the same pieces.
export { useNetworkGraph } from './composables/useNetworkGraph'
export { useViewProjection } from './composables/useViewProjection'
export { useFilters } from './composables/useFilters'
export { useCollapse } from './composables/useCollapse'
export { useLayout } from './composables/useLayout'
export { useFlowElements } from './composables/useFlowElements'
export { useSelection } from './composables/useSelection'
export { resolveTheme } from './composables/useTheme'
export { useNodeMarkers } from './composables/useNodeMarkers'
export type { NodeMarkerDef, ResolvedNodeMarker, MarkerAnchor } from './types/marker'
export { useTranslate } from './composables/useTranslate'
export { useMapContext } from './composables/useMapContext'
export type { MapContext } from './composables/useMapContext'
export type {
  EntityNodeData,
  GroupNodeData,
  NetworkEdgeData,
  NetworkNodeData,
} from './composables/useFlowElements'
export type { NodeSize } from './composables/useLayout'

export { builtinLocales, createTranslator, defaultLocale, en, resolveLocale, ru } from './locale/index'

export type {
  DetailsHeaderSlotProps,
  DetailsSlotProps,
  EdgeLabelSlotProps,
  EmptySlotProps,
  FocusOptions,
  InfectionOptions,
  NetworkMapExposed,
  NetworkMapLayoutSpec,
  NetworkMapModels,
  NetworkMapProps,
  NetworkMapSlots,
  NodeEventPayload,
  NodeSlotProps,
  Viewport,
} from './types/props'

export type {
  LocaleKey,
  LocaleMessages,
  PartialLocaleMessages,
  ResolvedTheme,
  ThemeConfig,
  ThemeMode,
  Translate,
} from './types/index'
