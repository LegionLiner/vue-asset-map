<script setup lang="ts" generic="E = unknown, L = unknown">
import { computed, ref, shallowRef, useSlots, watch, type Slot } from 'vue'
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
import { useFlowElements } from '../composables/useFlowElements'
import { provideMapContext, type ArrowDirection, type MapContext } from '../composables/useMapContext'
import DetailsPanel from './panel/DetailsPanel.vue'
import SearchInput from './controls/SearchInput.vue'
import ViewSwitcher from './controls/ViewSwitcher.vue'
import FilterMenu from './controls/FilterMenu.vue'
import MiniMap, { type MiniMapNode } from './MiniMap.vue'
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
  'node-expand': [payload: { id: EntityId; entity: NetworkEntity<E> | undefined }]
  'node-collapse': [payload: { id: EntityId; entity: NetworkEntity<E> | undefined }]
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
/** Узлы, чьи потомки скрыты кнопкой на самом узле. */
const collapsedNodes = defineModel<Set<EntityId>>('collapsedNodes', {
  default: () => new Set<EntityId>(),
})

defineSlots<NetworkMapSlots<E, L>>()

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
  collapsedNodes,
)

/**
 * Габариты узла для раскладки.
 *
 * Узел — круг с подписью под ним, поэтому высота зависит от размера круга и
 * числа строк подписи, а ширина берётся по подписи: она шире круга и именно она
 * определяет, когда узлы начнут наезжать друг на друга.
 */
const NODE_LABEL_WIDTH = 132
const NODE_CIRCLE = 36
const NODE_CIRCLE_ROOT = 60
const NODE_LABEL_GAP = 6
const NODE_LINE_HEIGHT = 16

function sizeOf(nodeId: string): NodeSize {
  const entity = graph.value.entities.get(nodeId)
  const circle = graph.value.parentOf.get(nodeId) === null ? NODE_CIRCLE_ROOT : NODE_CIRCLE
  const lines = 1 + (showSublabels.value ? (entity?.sublabels?.length ?? 0) : 0)

  return {
    width: NODE_LABEL_WIDTH,
    height: circle + NODE_LABEL_GAP + lines * NODE_LINE_HEIGHT,
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
 * Частичное обновление состояния фильтра.
 *
 * Всегда новый объект: `filters` может быть контролируемым снаружи через
 * `v-model:filters`, и правка на месте не породила бы события обновления —
 * вдобавок это была бы мутация объекта, принадлежащего потребителю.
 */
function patchFilters(patch: Partial<FilterState>): void {
  filters.value = { ...filters.value, ...patch }
}

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

const {
  fitView: flowFitView,
  setViewport,
  setCenter,
  viewport: flowViewport,
  dimensions: canvasSize,
} = useVueFlow()

/** Узлы для обзорной карты: только видимые, с уже вычисленными позициями. */
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

/** Клик по обзорной карте: центрируем полотно на выбранной точке. */
function focusPoint(point: XY): void {
  void setCenter(point.x, point.y, { zoom: flowViewport.value.zoom, duration: 200 })
}

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

/** Кнопка на самом узле: прячет и возвращает его поддерево. */
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

/**
 * Раскрытые списки в панели фильтров.
 *
 * Состояние компонента, а не `localStorage`: пакет не пишет в хранилище
 * браузера. Наружу уходит через `v-model:openFilterGroups` — сохранять его между
 * сессиями решает приложение.
 */
const openFilterGroups = defineModel<string[] | undefined>('openFilterGroups', {
  default: undefined,
})

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
  // Точный тип слотов из `defineSlots` сужает `useSlots()` до `NetworkMapSlots`,
  // а поиск по произвольному имени требует индексируемого объекта. Расширение
  // до `Record` — единственное место, где это нужно.
  slot: (name) => (slots as Record<string, Slot | undefined>)[name],
  statusColorOf: (status) => (status ? props.themeConfig?.statusColors?.[status] : undefined),
  iconFor: (kind) => props.themeConfig?.kindIcons?.[kind],
  groupById: (groupId) => collapseState.groupById.value.get(groupId),
  entityById: (id) => graph.value.entities.get(id),
  isRootNode: (id) => graph.value.parentOf.get(id) === null,
  hasChildren: (id) => (graph.value.childrenOf.get(id)?.length ?? 0) > 0,
  isSubtreeCollapsed: (id) => collapseState.isSubtreeCollapsed(id),
  onToggleSubtree,
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
      <div class="vnm-canvas" role="application" :aria-label="t('canvas.label')">
        <!-- Тулбар висит над полотном и своего фона не имеет: фон есть только у
             самих контролов. Так карта не теряет вертикального места. -->
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

            <!-- Один вид переключать не нужно, и место в тулбаре не бесконечное. -->
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

        <!-- Окно само достаёт слоты `details` и `details-header` из контекста
             карты: пробрасывать их вручную пришлось бы с `v-if` на каждый, чтобы
             не забить дефолтную реализацию пустым слотом. -->
        <DetailsPanel
          v-if="showDetailsPanel && detailsEntity && !panelClosed"
          :entity="detailsEntity"
          @close="closePanel"
        />
      </div>
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

/* Тулбар лежит поверх полотна и своего фона не имеет: фон только у контролов.
   `pointer-events` возвращаются самим контролам, чтобы полотно можно было тянуть
   в промежутках между ними. */
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

/* Поле поиска — единственный контрол с фиксированной шириной по макету. */
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

/* Стили панели живут в DetailsPanel.vue — там же, где её разметка. */

/* VueFlow рисует свои узлы в обёртке — снимаем её собственные рамки. */
.vnm-canvas .vue-flow__node {
  border: 0;
  background: transparent;
  font-family: var(--vnm-font);
}
</style>
