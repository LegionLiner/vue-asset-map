/**
 * Публичный API пакета `network-map`.
 *
 * Ядро доступно и отдельным подпутём `network-map/core` — там нет ни Vue, ни
 * VueFlow, поэтому его можно использовать на сервере. Стили подключаются
 * отдельно: `import 'network-map/style.css'`.
 */

export * from './core/index'

// Раскладки: `manual` и `radial` встроены, `dagre` — отдельным подпутём
// `network-map/layout-dagre`, чтобы опциональная зависимость не попадала в
// основной бандл.
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

// Компоненты
export { default as NetworkMap } from './components/NetworkMap.vue'
export { default as BaseNode } from './components/nodes/BaseNode.vue'
export { default as GroupNode } from './components/nodes/GroupNode.vue'
export { default as NetworkEdge } from './components/edges/NetworkEdge.vue'
export { default as MiniMap } from './components/MiniMap.vue'
// Каркас плавающего окна: из него собираются свои окна для слота `#windows`.
export { default as MapWindow } from './components/MapWindow.vue'
export type { MiniMapNode } from './components/MiniMap.vue'
export { default as DetailsPanel } from './components/panel/DetailsPanel.vue'
export { default as DetailsSection } from './components/panel/DetailsSection.vue'
// Контролы работают и вне карты: локаль они берут из контекста, а при его
// отсутствии — из встроенной.
export { default as SearchInput } from './components/controls/SearchInput.vue'
export { default as ViewSwitcher } from './components/controls/ViewSwitcher.vue'
export { default as FilterMenu } from './components/controls/FilterMenu.vue'

// Реестр типов узлов — для тех, кто собирает свой набор компонентов.
export {
  buildEdgeTypes,
  buildNodeTypes,
  EDGE_TYPE_BASE,
  edgeTypeFor,
  NODE_TYPE_BASE,
  NODE_TYPE_GROUP,
  nodeTypeFor,
} from './registry/nodeRegistry'

// Composables: карту можно собрать и вручную, из тех же кусков.
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

// Локализация
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
