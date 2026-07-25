import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import type { EntityId, NetworkEntity } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { NodeMarkerDef, ResolvedNodeMarker } from '../types/marker'

export interface UseNodeMarkersReturn {
  /** Маркеры сущности в порядке объявления. */
  markersFor: (id: EntityId) => readonly ResolvedNodeMarker[]
  /** Маркер, на который сейчас навели и выдержали задержку. */
  hoveredMarker: Ref<string | undefined>
  /** Сущности, у которых есть наведённый маркер. */
  memberIds: ComputedRef<ReadonlySet<EntityId>>
  /** Навести: подсветка включится после задержки. */
  onMarkerEnter: (markerId: string) => void
  /** Убрать курсор: отменяет и ожидание, и подсветку. */
  onMarkerLeave: () => void
  /** Включить подсветку немедленно — для фокуса с клавиатуры. */
  onMarkerFocus: (markerId: string) => void
}

const DEFAULT_HOVER_DELAY_MS = 500

/** Палитра по умолчанию: цвета раздаются маркерам по порядку объявления. */
const PALETTE = ['var(--vnm-marker-1)', 'var(--vnm-marker-2)', 'var(--vnm-marker-3)'] as const

/**
 * Маркеры принадлежности узлов и подсветка по наведению.
 *
 * Соответствие «сущность → маркеры» считается один раз на смену данных: иначе
 * каждый узел на каждом рендере прогонял бы по себе все предикаты `match`.
 *
 * Задержка перед подсветкой нужна, чтобы курсор, проходящий над кружками по
 * пути к чему-то другому, не устраивал мигание всей карты. Уход курсора
 * отменяет и ожидание, и уже включённую подсветку.
 */
export function useNodeMarkers<E, L>(
  graph: Ref<NetworkGraph<E, L>> | ComputedRef<NetworkGraph<E, L>>,
  markers: Ref<NodeMarkerDef[] | undefined>,
  hoverDelay: Ref<number | undefined>,
): UseNodeMarkersReturn {
  /** Маркеры с раздатым цветом: индекс в палитре зависит только от порядка. */
  const resolved = computed<ResolvedNodeMarker[]>(() =>
    (markers.value ?? []).map((marker, index) => ({
      id: marker.id,
      color: marker.color ?? (PALETTE[index % PALETTE.length] as string),
      label: marker.label ?? marker.id,
    })),
  )

  /**
   * Индекс «сущность → её маркеры».
   *
   * Обход идёт по маркерам, а не по сущностям: маркер с `members` считает свой
   * состав одним проходом по графу, тогда как предикат `match` пришлось бы
   * вызывать сущности × маркеры раз. Порядок кружков у узла — порядок объявления
   * маркеров, потому что внешний цикл идёт по ним.
   */
  const byEntity = computed(() => {
    const index = new Map<EntityId, ResolvedNodeMarker[]>()
    const defs = markers.value
    if (!defs || defs.length === 0) return index

    const attach = (entityId: EntityId, marker: ResolvedNodeMarker): void => {
      const own = index.get(entityId)
      if (own) own.push(marker)
      else index.set(entityId, [marker])
    }

    defs.forEach((def, position) => {
      const marker = resolved.value[position]
      if (!marker) return

      if (def.members) {
        for (const entityId of def.members(graph.value)) {
          // Маркер мог назвать узел, которого в данных уже нет.
          if (graph.value.entities.has(entityId)) attach(entityId, marker)
        }
        return
      }

      const match = def.match
      if (!match) return
      for (const entity of graph.value.entities.values()) {
        if (match(entity as NetworkEntity, graph.value)) attach(entity.id, marker)
      }
    })

    return index
  })

  const hoveredMarker = ref<string | undefined>(undefined)

  const memberIds = computed<ReadonlySet<EntityId>>(() => {
    const markerId = hoveredMarker.value
    if (markerId === undefined) return new Set()

    const members = new Set<EntityId>()
    for (const [entityId, own] of byEntity.value) {
      if (own.some((marker) => marker.id === markerId)) members.add(entityId)
    }
    return members
  })

  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = (): void => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const onMarkerEnter = (markerId: string): void => {
    clearTimer()
    const delay = hoverDelay.value ?? DEFAULT_HOVER_DELAY_MS
    if (delay <= 0) {
      hoveredMarker.value = markerId
      return
    }
    timer = setTimeout(() => {
      hoveredMarker.value = markerId
      timer = undefined
    }, delay)
  }

  const onMarkerLeave = (): void => {
    clearTimer()
    hoveredMarker.value = undefined
  }

  /** С клавиатуры ждать нечего: фокус — уже осознанное действие. */
  const onMarkerFocus = (markerId: string): void => {
    clearTimer()
    hoveredMarker.value = markerId
  }

  onScopeDispose(clearTimer)

  return {
    markersFor: (id) => byEntity.value.get(id) ?? [],
    hoveredMarker,
    memberIds,
    onMarkerEnter,
    onMarkerLeave,
    onMarkerFocus,
  }
}
