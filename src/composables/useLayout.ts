import { computed, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { EntityId, XY } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { CollapseResult } from '../types/collapse'
import type { NetworkView } from '../types/view'
import type { NetworkMapLayoutSpec } from '../types/props'
import { isLayoutAborted, type LayoutEngine, type LayoutGraph, type LayoutNode } from '../layout/types'
import { resolveLayoutEngine } from '../layout/index'
import { manualLayout } from '../layout/manual'

export interface NodeSize {
  width: number
  height: number
}

export interface UseLayoutParams<E, L> {
  graph: ComputedRef<NetworkGraph<E, L>>
  collapsed: ComputedRef<CollapseResult<unknown>>
  /** Раскладка из props — сильнее, чем раскладка вида. */
  spec: Ref<NetworkMapLayoutSpec | undefined>
  view: ComputedRef<NetworkView | undefined>
  /** Дополнительные движки, зарегистрированные потребителем. */
  engines?: Ref<Readonly<Record<string, LayoutEngine>> | undefined>
  sizeOf: (nodeId: string) => NodeSize
  onStart?: (engineName: string) => void
  onDone?: (engineName: string, positionCount: number) => void
  onError?: (error: unknown) => void
}

export interface UseLayoutReturn {
  positions: Ref<ReadonlyMap<EntityId, XY>>
  running: Ref<boolean>
  engineName: ComputedRef<string>
  relayout: () => Promise<void>
  /** Записать позицию, полученную перетаскиванием мышью. */
  setManualPosition: (id: EntityId, position: XY) => void
  clearManualPositions: () => void
  /** Итоговая позиция узла с учётом приоритетов. */
  positionOf: (id: string) => XY | undefined
}

/**
 * Запуск раскладки и применение её результата.
 *
 * Приоритет позиций: перетащенное мышью → `entity.position` с бэкенда →
 * результат движка. Первые два уходят в движок как `pinned`, поэтому движок их
 * не переставляет, а не «переставляет, но мы потом чиним».
 *
 * Каждый новый запрос отменяет предыдущий через `AbortSignal`: если пользователь
 * успел трижды переключить вид, применится результат только последней раскладки.
 * Результат применяется одним присваиванием `Map` — один триггер реактивности на
 * всю раскладку, а не на узел.
 *
 * Раскладка сознательно не зависит от фильтра: поиск скрывает и подсвечивает
 * узлы, но не перестраивает карту — иначе граф прыгал бы на каждой набранной
 * букве.
 */
export function useLayout<E, L>(params: UseLayoutParams<E, L>): UseLayoutReturn {
  const { graph, collapsed, spec, view, engines, sizeOf, onStart, onDone, onError } = params

  const positions = shallowRef<ReadonlyMap<EntityId, XY>>(new Map())
  const manual = shallowRef<ReadonlyMap<EntityId, XY>>(new Map())
  const running = ref(false)

  let controller: AbortController | undefined

  /** Раскладка из props сильнее раскладки вида: props ближе к потребителю. */
  const activeSpec = computed<NetworkMapLayoutSpec | undefined>(() => spec.value ?? view.value?.layout)

  const engine = computed<LayoutEngine>(() => {
    const requested = activeSpec.value?.engine
    const resolved = resolveLayoutEngine(requested, engines?.value)
    if (resolved) return resolved
    if (typeof requested === 'string') {
      // Имя движка приходит из данных вида, то есть снаружи. Опечатка не должна
      // гасить карту — откатываемся на manual и сообщаем наружу.
      onError?.(new Error(`Unknown layout engine "${requested}", falling back to "manual"`))
    }
    return manualLayout
  })

  const engineName = computed(() => engine.value.name)

  const pinnedOf = (id: string): XY | undefined =>
    manual.value.get(id) ?? graph.value.entities.get(id)?.position

  function buildLayoutGraph(): LayoutGraph {
    const nodes: LayoutNode[] = collapsed.value.nodeIds.map((id) => {
      const size = sizeOf(id)
      const pinned = pinnedOf(id)
      return { id, width: size.width, height: size.height, ...(pinned ? { pinned } : {}) }
    })

    return {
      nodes,
      edges: collapsed.value.links.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
      })),
    }
  }

  async function relayout(): Promise<void> {
    controller?.abort()
    const current = new AbortController()
    controller = current

    const active = engine.value
    running.value = true
    onStart?.(active.name)

    try {
      const result = await active.run(buildLayoutGraph(), activeSpec.value?.options, current.signal)

      // Пока раскладка считалась, мог прийти новый запрос. Устаревший результат
      // не применяется — проверка нужна и здесь, а не только внутри движка:
      // сторонний движок может не уважать signal.
      if (current.signal.aborted || controller !== current) return

      positions.value = result
      onDone?.(active.name, result.size)
    } catch (error) {
      if (isLayoutAborted(error)) return
      onError?.(error)
    } finally {
      if (controller === current) {
        running.value = false
        controller = undefined
      }
    }
  }

  // Пересчёт при смене структуры схлопнутого графа, вида или движка.
  // `collapsed` — новый объект на каждое перевычисление, поэтому его хватает как
  // признака «граф изменился».
  watch([collapsed, engine, activeSpec], () => void relayout(), { immediate: true })

  const setManualPosition = (id: EntityId, position: XY): void => {
    const next = new Map(manual.value)
    next.set(id, { x: position.x, y: position.y })
    manual.value = next
  }

  const clearManualPositions = (): void => {
    if (manual.value.size === 0) return
    manual.value = new Map()
  }

  /**
   * Итоговая позиция. Приоритет тот же, что и при передаче в движок, — так
   * узел не дёргается между «до» и «после» применения результата.
   */
  const positionOf = (id: string): XY | undefined =>
    manual.value.get(id) ?? graph.value.entities.get(id)?.position ?? positions.value.get(id)

  onScopeDispose(() => controller?.abort())

  return {
    positions,
    running,
    engineName,
    relayout,
    setManualPosition,
    clearManualPositions,
    positionOf,
  }
}
