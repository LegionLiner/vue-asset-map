<script setup lang="ts" generic="E = unknown, L = unknown">
import { computed, ref, shallowRef, useSlots, watch } from 'vue'
import { VueFlow, useVueFlow, type NodeDragEvent } from '@vue-flow/core'
import type { EntityId, XY } from '../types/entity'
import type { CollapsedGroup } from '../types/collapse'
import type { FilterState } from '../types/filter'
import type { NetworkGraph } from '../types/graph'
import type {
  FocusOptions,
  NetworkMapExposed,
  NetworkMapProps,
  NodeEventPayload,
  Viewport,
} from '../types/props'
import { useNetworkGraph } from '../composables/useNetworkGraph'
import { useViewProjection } from '../composables/useViewProjection'
import { useFilters } from '../composables/useFilters'
import { useCollapse } from '../composables/useCollapse'
import { useLayout, type NodeSize } from '../composables/useLayout'
import { useSelection } from '../composables/useSelection'
import { useFlowElements } from '../composables/useFlowElements'
import { provideMapContext, type ArrowDirection, type MapContext } from '../composables/useMapContext'
import { buildEdgeTypes, buildNodeTypes } from '../registry/nodeRegistry'
import { createTranslator, resolveLocale } from '../locale/index'
import { findPaths } from '../core/traverse'
import { resolveTheme } from '../composables/useTheme'

const props = withDefaults(defineProps<NetworkMapProps<E, L>>(), {
  showToolbar: true,
  showDetailsPanel: true,
  showMinimap: false,
  onlyRenderVisibleElements: true,
  lodThreshold: 0.5,
  loading: false,
  // `collapse` по типу — `CollapseRule | false`, поэтому Vue считает его
  // boolean-пропом и по своим правилам приводит отсутствующее значение к `false`.
  // Без явного `default: undefined` свёртка была бы выключена по умолчанию —
  // ровно противоположно требованию «группа >10 детей свёрнута».
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
  'selection-change': [ids: EntityId[]]
  'layout-start': [engine: string]
  'layout-done': [payload: { engine: string; positions: number }]
  error: [error: unknown]
}>()

/**
 * Двусторонние привязки.
 *
 * `defineModel` — это и есть «useVModel-подобный паттерн» из требований: если
 * снаружи есть `v-model`, состояние контролируется снаружи; если нет — ref
 * работает как локальный, и компонент управляет состоянием сам.
 */
const viewId = defineModel<string | undefined>('view', { default: undefined })
const selection = defineModel<EntityId[]>('selection', { default: () => [] })
const expanded = defineModel<Set<string>>('expanded', { default: () => new Set<string>() })
const filters = defineModel<FilterState>('filters', {
  default: (): FilterState => ({ query: '', kinds: [], statuses: [] }),
})
const viewport = defineModel<Viewport>('viewport', { default: () => ({ x: 0, y: 0, zoom: 1 }) })

const slots = useSlots()

// --- Локаль и тема ---------------------------------------------------------

const messages = computed(() => resolveLocale(props.locale))
const t = computed(() => createTranslator(messages.value))

const theme = resolveTheme(computed(() => props.theme))

// --- Конвейер данных -------------------------------------------------------

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
  // Свёртка строится по проекции вида, а не по результату фильтра: иначе набор
  // групп менялся бы на каждой букве в поиске и карта перестраивалась бы под
  // руками. Фильтр влияет только на видимость и подсветку.
  computed(() => projection.value.entityIds),
  projection,
  computed(() => props.collapse),
  expanded,
)

const NODE_SIZE: NodeSize = { width: 180, height: 72 }
const sizeOf = (): NodeSize => NODE_SIZE

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

const selectionState = useSelection(selection)

watch(
  () => selection.value,
  (ids) => emit('selection-change', [...ids]),
)

// --- Реестры компонентов ---------------------------------------------------

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

// --- VueFlow ---------------------------------------------------------------

const { fitView: flowFitView, setViewport, setCenter, viewport: flowViewport } = useVueFlow()

const simplified = computed(() => flowViewport.value.zoom < props.lodThreshold)

/** Синхронизация вьюпорта в обе стороны без петли обновлений. */
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

// --- Подсветка пути --------------------------------------------------------

const highlightedNodeIds = shallowRef<ReadonlySet<string>>(new Set())
const highlightedEdgeIds = shallowRef<ReadonlySet<string>>(new Set())

function clearHighlight(): void {
  if (highlightedNodeIds.value.size === 0 && highlightedEdgeIds.value.size === 0) return
  highlightedNodeIds.value = new Set()
  highlightedEdgeIds.value = new Set()
}

/**
 * Подсветка пути между двумя узлами.
 *
 * Ищется по исходному графу с учётом слоёв текущего вида, а рисуется по
 * схлопнутому: если участок пути спрятан в группу, подсвечивается групповой узел
 * и ведущие к нему рёбра — иначе путь визуально обрывался бы.
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

// --- Взаимодействия --------------------------------------------------------

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

function onPaneClick(event: MouseEvent): void {
  selectionState.clear()
  clearHighlight()
  emit('pane-click', event)
}

/** Перетаскивание мышью — высший приоритет позиции, релэйаут его не сбросит. */
function onNodeDragStop(event: NodeDragEvent): void {
  for (const node of event.nodes) {
    layoutState.setManualPosition(node.id, { x: node.position.x, y: node.position.y })
  }
}

// --- Клавиатура ------------------------------------------------------------

const ARROW_VECTORS: Readonly<Record<ArrowDirection, XY>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * Переход к соседу по стрелке.
 *
 * Из всех соседей по схлопнутому графу берётся тот, чьё направление ближе всего
 * к направлению стрелки, и только в пределах полукруга — иначе «вверх» уводило
 * бы к узлу, лежащему сбоку или вовсе снизу.
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

    // Косинус угла между направлением стрелки и направлением на соседа.
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
  // Escape закрывает панель, а не сбрасывает выделение: панель — то, что
  // перекрывает карту, и убрать её пользователь хочет в первую очередь.
  if (panelClosed.value) return
  closePanel()
}

// --- Панель подробностей ---------------------------------------------------

const panelClosed = ref(false)

function closePanel(): void {
  panelClosed.value = true
}

watch(
  () => selectionState.primaryId.value,
  (id) => {
    // Новый выбор всегда открывает панель заново: закрытие относится к
    // конкретному узлу, а не к режиму работы карты.
    if (id !== undefined) panelClosed.value = false
  },
)

const detailsEntity = computed(() => {
  const id = selectionState.primaryId.value
  if (id === undefined) return undefined
  return graph.value.entities.get(id)
})

// --- Контекст для узлов и рёбер -------------------------------------------

const context: MapContext = {
  t: (key, params) => t.value(key, params),
  graph,
  showSublabels,
  simplified,
  slots,
  statusColorOf: (status) => (status ? props.themeConfig?.statusColors?.[status] : undefined),
  iconFor: (kind) => props.themeConfig?.kindIcons?.[kind],
  groupById: (groupId) => collapseState.groupById.value.get(groupId),
  entityById: (id) => graph.value.entities.get(id),
  isSelected: (id) => selectionState.isSelected(id),
  isMatched: (id) => filterState.matchedIds.value.has(id),
  isDimmed: (id) => filterState.active.value && !filterState.matchedIds.value.has(id),
  isHighlighted: (id) => highlightedNodeIds.value.has(id),
  isEdgeHighlighted: (edgeId) => highlightedEdgeIds.value.has(edgeId),
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

// --- Публичный API ---------------------------------------------------------

const isEmpty = computed(() => nodes.value.every((node) => node.hidden === true))

async function fitView(): Promise<void> {
  await flowFitView({ padding: 0.2 })
}

async function focus(id: EntityId, options?: FocusOptions): Promise<void> {
  const position = layoutState.positionOf(id)
  if (!position) return

  if (options?.select !== false) selectionState.select(id)

  await setCenter(position.x + NODE_SIZE.width / 2, position.y + NODE_SIZE.height / 2, {
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
    <div v-if="showToolbar" class="vnm-toolbar">
      <div class="vnm-toolbar__group">
        <slot name="toolbar-left" />
      </div>
      <div class="vnm-toolbar__group vnm-toolbar__group--end">
        <slot name="toolbar-right" />
      </div>
    </div>

    <div class="vnm-body">
      <div class="vnm-canvas" role="application" :aria-label="t('canvas.label')">
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

        <div v-if="loading" class="vnm-overlay" role="status">
          <slot name="loading">{{ t('canvas.loading') }}</slot>
        </div>

        <div v-else-if="isEmpty" class="vnm-overlay">
          <slot name="empty">{{ t('canvas.empty') }}</slot>
        </div>
      </div>

      <aside v-if="showDetailsPanel && detailsEntity && !panelClosed" class="vnm-panel">
        <slot name="details" :entity="detailsEntity" :close="closePanel">
          <div class="vnm-panel__header">
            <slot name="details-header" :entity="detailsEntity">
              <span class="vnm-panel__title">{{ detailsEntity.label }}</span>
            </slot>
            <button
              type="button"
              class="vnm-panel__close"
              :aria-label="t('details.close')"
              @click="closePanel"
            >
              ×
            </button>
          </div>
        </slot>
      </aside>
    </div>
  </div>
</template>

<style>
/* Токены и темы подтягиваются здесь, а не импортом из JS.
 *
 * Причина: `import './style.css'` внутри опубликованного ESM-модуля ломает
 * загрузку пакета в чистом Node (SSR без бандлера). А `@import` в CSS Vite
 * инлайнит на сборке, поэтому токены попадают в `dist/style.css` — без него
 * потребитель получил бы компоненты, у которых все var(--vnm-*) не определены.
 *
 * Импорт живёт именно в этом компоненте: он рендерит `.vnm-root`, а токены
 * объявлены ровно на этом классе. */
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
}

.vnm-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--vnm-space-3);
  min-height: var(--vnm-toolbar-height);
  padding: var(--vnm-space-2) var(--vnm-space-3);
  border-bottom: 1px solid var(--vnm-border);
  background: var(--vnm-surface);
}

.vnm-toolbar__group {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  min-width: 0;
}

.vnm-toolbar__group--end {
  justify-content: flex-end;
}

.vnm-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.vnm-canvas {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  background-color: var(--vnm-bg);
  /* Точечная сетка полотна: своим фоном, без пакета @vue-flow/background. */
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

.vnm-panel {
  display: flex;
  flex: 0 0 var(--vnm-panel-width);
  flex-direction: column;
  width: var(--vnm-panel-width);
  min-height: 0;
  border-left: 1px solid var(--vnm-border);
  background: var(--vnm-surface);
  overflow-y: auto;
}

.vnm-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--vnm-space-2);
  padding: var(--vnm-space-3);
  border-bottom: 1px solid var(--vnm-border);
}

.vnm-panel__title {
  font-size: var(--vnm-font-size-lg);
  font-weight: var(--vnm-font-weight-bold);
}

.vnm-panel__close {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-lg);
  line-height: 1;
  cursor: pointer;
}

.vnm-panel__close:hover {
  border-color: var(--vnm-border);
  background: var(--vnm-surface-sunken);
  color: var(--vnm-fg);
}

.vnm-panel__close:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

/* VueFlow рисует свои узлы в обёртке — снимаем её собственные рамки. */
.vnm-canvas .vue-flow__node {
  border: 0;
  background: transparent;
  font-family: var(--vnm-font);
}
</style>
