import type { Component } from 'vue'
import type { EntityId, NetworkEntity, XY } from './entity'
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
