import { inject, provide, type Component, type ComputedRef, type InjectionKey, type Slot } from 'vue'
import type { EntityId, NetworkEntity } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { CollapsedGroup } from '../types/collapse'
import type { Translate } from '../types/locale'

export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

/**
 * Всё, что узлам и рёбрам нужно от карты.
 *
 * Через provide/inject, а не через props каждого узла: эти значения общие для
 * всех узлов и меняются редко (тема, локаль, LOD), а взаимодействия должны
 * попадать в карту напрямую, минуя событийную систему VueFlow — так поведение не
 * зависит от того, включено ли у VueFlow собственное выделение.
 */
export interface MapContext {
  t: Translate
  graph: ComputedRef<NetworkGraph<unknown, unknown>>

  /** Показывать ли подписи под именем в текущем виде. */
  showSublabels: ComputedRef<boolean>
  /** `true` — масштаб ниже порога, узлы рисуются упрощённо. */
  simplified: ComputedRef<boolean>

  /**
   * Слот карты по имени.
   *
   * Функция, а не сам объект слотов: у `NetworkMap` слоты описаны точным типом
   * (`NetworkMapSlots`), и он несовместим с внутренним `Slots` из Vue. Поиск по
   * имени — единственное, что нужно узлам, рёбрам и панели.
   */
  slot: (name: string) => Slot | undefined

  statusColorOf: (status: string | undefined) => string | undefined
  iconFor: (kind: string) => Component | undefined
  groupById: (groupId: string) => CollapsedGroup | undefined
  entityById: (id: EntityId) => NetworkEntity<unknown> | undefined

  isSelected: (id: string) => boolean
  isMatched: (id: string) => boolean
  isDimmed: (id: string) => boolean
  isHighlighted: (id: string) => boolean
  isEdgeHighlighted: (edgeId: string) => boolean

  onNodeClick: (id: string, event: MouseEvent) => void
  onNodeDoubleClick: (id: string, event: MouseEvent) => void
  onNodeContextMenu: (id: string, event: MouseEvent) => void
  onGroupToggle: (groupId: string, event: Event) => void
  onEdgeClick: (edgeId: string, event: MouseEvent) => void

  /** Клавиатура: переход к соседу по стрелке. */
  onArrowNavigate: (id: string, direction: ArrowDirection) => void
  registerNodeElement: (id: string, element: HTMLElement | undefined) => void
}

export const MAP_CONTEXT_KEY: InjectionKey<MapContext> = Symbol('vnm-map-context')

export function provideMapContext(context: MapContext): void {
  provide(MAP_CONTEXT_KEY, context)
}

/**
 * Контекст карты внутри узла или ребра.
 *
 * Бросает понятную ошибку, если компонент отрендерили вне `<NetworkMap>`: без
 * этого потребитель получил бы `undefined is not a function` где-то в глубине
 * рендера кастомного узла.
 */
export function useMapContext(): MapContext {
  const context = inject(MAP_CONTEXT_KEY, undefined)
  if (!context) {
    throw new Error('[network-map] Node and edge components must be rendered inside <NetworkMap>')
  }
  return context
}
