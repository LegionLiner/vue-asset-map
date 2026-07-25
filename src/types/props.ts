import type { Component } from 'vue'
import type { Badge, EntityId, NetworkEntity, XY } from './entity'
import type { NetworkLink } from './link'
import type { NetworkView } from './view'
import type { CollapsedGroup, CollapseRule } from './collapse'
import type { NetworkGraph } from './graph'
import type { FilterOptions, FilterState } from './filter'
import type { PartialLocaleMessages } from './locale'
import type { ThemeConfig, ThemeMode } from './theme'
import type { LayoutEngine } from '../layout/types'

export interface NetworkMapLayoutSpec {
  engine: string | LayoutEngine
  options?: unknown
}

/**
 * Маркер принадлежности — кружок под подписью узла.
 *
 * Показывает те же группировки, что и связи, но читается взглядом: не нужно
 * ничего нажимать, чтобы понять, что к чему относится. Наведение на кружок
 * подсвечивает всех, у кого он есть.
 */
export interface NodeMarkerDef {
  id: string
  /** Цвет заполнения. Без него берётся из палитры токенов по порядку. */
  color?: string
  /** Подпись для screen reader и подсказки. Без неё используется `id`. */
  label?: string
  /** Есть ли этот маркер у сущности. */
  match: (entity: NetworkEntity) => boolean
}

/** Маркер с уже выбранным цветом — то, что получает узел. */
export interface ResolvedNodeMarker {
  id: string
  color: string
  label: string
}

/** Как считать распространение «заражения» от помеченных сущностей. */
export interface InfectionOptions {
  /** Дефолт `downstream`: по направлению связей. */
  direction?: 'downstream' | 'upstream' | 'both'
  /** Ограничить распространение числом шагов. Дефолт — без ограничения. */
  maxDepth?: number
  /** Считать только по этим слоям связей. Дефолт — по слоям текущего вида. */
  layers?: string[]
}

export interface Viewport extends XY {
  zoom: number
}

export interface NetworkMapProps<E = unknown, L = unknown> {
  entities: NetworkEntity<E>[]
  links: NetworkLink<L>[]
  views?: NetworkView[]

  /** Реестр компонентов узлов: kind → component. Мержится с дефолтным. */
  nodeTypes?: Record<string, Component>
  edgeTypes?: Record<string, Component>

  layout?: NetworkMapLayoutSpec
  collapse?: CollapseRule | false
  filterOptions?: FilterOptions

  theme?: ThemeMode
  themeConfig?: ThemeConfig
  locale?: string | PartialLocaleMessages

  /** Показывать встроенные контролы. Дефолт true — иначе всё через слоты. */
  showToolbar?: boolean
  showDetailsPanel?: boolean
  showMinimap?: boolean

  /**
   * Сколько окон подробностей можно держать открытыми одновременно. Дефолт 1.
   *
   * При достижении лимита самое старое окно закрывается. `0` полностью
   * отключает окна, не убирая остальной интерфейс.
   */
  maxDetailsWindows?: number

  /**
   * На сколько шагов подсвечивать связи выделенного узла. Дефолт 1.
   *
   * Всё, что дальше, затемняется. `0` выключает подсветку по выделению.
   */
  neighborHighlightDepth?: number

  /**
   * Помеченные «заражёнными» сущности.
   *
   * Карта показывает не только их, но и всё, что они захватывают: набор считается
   * через `blastRadius`, поэтому распространение видно целиком.
   */
  infected?: EntityId[]
  infectionOptions?: InfectionOptions

  /**
   * Маркеры принадлежности под подписью узла.
   *
   * Порядок кружков повторяет порядок этого массива, поэтому одинаковые маркеры
   * у разных узлов всегда стоят на одном месте.
   */
  markers?: NodeMarkerDef[]
  /** Задержка перед подсветкой при наведении на кружок, мс. Дефолт 500. */
  markerHoverDelay?: number

  /** Рендерить только видимые элементы полотна. Дефолт true. */
  onlyRenderVisibleElements?: boolean
  /** Порог масштаба, ниже которого узлы рисуются упрощённо. Дефолт 0.5. */
  lodThreshold?: number
  /** Задержка перед применением поискового запроса, мс. Дефолт 200. */
  searchDebounce?: number
  /** Показывать индикатор загрузки поверх полотна. */
  loading?: boolean
}

/** Двусторонние привязки. Без `v-model` компонент управляет состоянием сам. */
export interface NetworkMapModels {
  view?: string
  selection?: EntityId[]
  expanded?: Set<string>
  filters?: FilterState
  viewport?: Viewport
}

/** Полезная нагрузка событий по узлу: и сущность, и группа — что там оказалось. */
export interface NodeEventPayload {
  id: string
  entity: NetworkEntity<unknown> | undefined
  group: CollapsedGroup | undefined
  event: MouseEvent
}

export interface FocusOptions {
  /** Масштаб после перехода к узлу. Дефолт — текущий. */
  zoom?: number
  /** Длительность анимации, мс. Дефолт 400. */
  duration?: number
  /** Выделить узел заодно. Дефолт true. */
  select?: boolean
}

/** Слот без параметров. */
export type EmptySlotProps = Record<string, never>

/**
 * Параметры слотов `node-*`.
 *
 * Один тип на все слоты этого семейства — и на `#node-{kind}`, и на
 * `#node-badge`. Иначе их нельзя описать общей сигнатурой `node-${string}`, а без
 * неё TypeScript не пропустит слот с произвольным именем типа `#node-router`.
 */
export interface NodeSlotProps<E = unknown> {
  entity: NetworkEntity<E> | undefined
  nodeId: string
  /** `true` — масштаб ниже порога LOD, узел рисуется упрощённо. */
  simplified: boolean
  /** Заполнен только для слота `node-badge`. */
  badge?: Badge
}

export interface DetailsSlotProps<E = unknown> {
  entity: NetworkEntity<E>
  close: () => void
  /** Активный таб панели. */
  tab: string
}

export interface DetailsHeaderSlotProps<E = unknown> {
  entity: NetworkEntity<E>
  close: () => void
}

export interface EdgeLabelSlotProps<L = unknown> {
  link: NetworkLink<L> | undefined
  aggregated: boolean
  count: number
}

/**
 * Публичный контракт слотов.
 *
 * Объявляется через `defineSlots`, а не выводится из шаблона: узлы и рёбра
 * рендерятся внутри VueFlow и берут слоты из контекста карты, поэтому вывести их
 * из разметки `NetworkMap` невозможно.
 */
export type NetworkMapSlots<E = unknown, L = unknown> = {
  'toolbar-left'?(props: EmptySlotProps): unknown
  'toolbar-right'?(props: EmptySlotProps): unknown
  empty?(props: EmptySlotProps): unknown
  loading?(props: EmptySlotProps): unknown
  /**
   * Свои плавающие окна поверх полотна.
   *
   * Рендерится выше окон подробностей. Собирайте окна из экспортируемого
   * `<MapWindow>` — тогда они получат ту же шапку, перетаскивание и токены темы.
   */
  windows?(props: EmptySlotProps): unknown
  details?(props: DetailsSlotProps<E>): unknown
  'details-header'?(props: DetailsHeaderSlotProps<E>): unknown
  'edge-label'?(props: EdgeLabelSlotProps<L>): unknown
} & {
  [kind: `node-${string}`]: ((props: NodeSlotProps<E>) => unknown) | undefined
}

/**
 * Императивный API компонента — то, что отдаёт `defineExpose`.
 *
 * Вынесен в отдельный тип, чтобы потребитель мог типизировать `ref` на карту:
 * `InstanceType<typeof NetworkMap>` у дженерик-компонента не даёт удобного типа.
 */
export interface NetworkMapExposed<E = unknown, L = unknown> {
  fitView: () => Promise<void>
  focus: (id: EntityId, options?: FocusOptions) => Promise<void>
  relayout: () => Promise<void>
  /** Возвращает найденный путь в исходных id или пустой массив. */
  highlightPath: (from: EntityId, to: EntityId) => EntityId[]
  clearHighlight: () => void
  getGraph: () => NetworkGraph<E, L>
}
