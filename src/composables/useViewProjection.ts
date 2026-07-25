import { computed, type ComputedRef, type Ref } from 'vue'
import { projectGraph, resolveView } from '../core/project'
import type { NetworkGraph } from '../types/graph'
import type { NetworkView, ProjectionResult } from '../types/view'

/** Return value of {@link useViewProjection}. */
export interface UseViewProjectionReturn {
  view: ComputedRef<NetworkView | undefined>
  projection: ComputedRef<ProjectionResult>
  showSublabels: ComputedRef<boolean>
}

/**
 * Applies the current view to the graph.
 *
 * Views are data, not code: `viewId` arrives from outside through `v-model:view`
 * and may be unknown — persisted from an older configuration, say. `resolveView`
 * then falls back to the first view so the map is never left empty.
 */
export function useViewProjection<E, L>(
  graph: Ref<NetworkGraph<E, L>> | ComputedRef<NetworkGraph<E, L>>,
  views: Ref<NetworkView[] | undefined>,
  viewId: Ref<string | undefined>,
): UseViewProjectionReturn {
  const view = computed(() => resolveView(views.value, viewId.value))
  const projection = computed(() => projectGraph(graph.value, view.value))

  // Sublabels show by default: hiding them is a deliberate choice of a view.
  const showSublabels = computed(() => view.value?.showSublabels ?? true)

  return { view, projection, showSublabels }
}
