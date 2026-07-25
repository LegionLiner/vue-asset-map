import { computed, type ComputedRef, type Ref } from 'vue'
import { projectGraph, resolveView } from '../core/project'
import type { NetworkGraph } from '../types/graph'
import type { NetworkView, ProjectionResult } from '../types/view'

export interface UseViewProjectionReturn {
  view: ComputedRef<NetworkView | undefined>
  projection: ComputedRef<ProjectionResult>
  showSublabels: ComputedRef<boolean>
}

/**
 * Применение текущего вида к графу.
 *
 * Вид — это данные, а не код: `viewId` приходит снаружи через `v-model:view` и
 * может оказаться неизвестным (например, сохранённым от предыдущей версии
 * конфигурации). `resolveView` в таком случае откатывается на первый вид, чтобы
 * карта не оказалась пустой.
 */
export function useViewProjection<E, L>(
  graph: Ref<NetworkGraph<E, L>> | ComputedRef<NetworkGraph<E, L>>,
  views: Ref<NetworkView[] | undefined>,
  viewId: Ref<string | undefined>,
): UseViewProjectionReturn {
  const view = computed(() => resolveView(views.value, viewId.value))
  const projection = computed(() => projectGraph(graph.value, view.value))

  // Без вида подписи показываются: скрывать их — осознанное решение вида.
  const showSublabels = computed(() => view.value?.showSublabels ?? true)

  return { view, projection, showSublabels }
}
