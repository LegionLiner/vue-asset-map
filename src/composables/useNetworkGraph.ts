import { computed, markRaw, type ComputedRef, type Ref } from 'vue'
import { buildGraph } from '../core/graph'
import type { NetworkEntity } from '../types/entity'
import type { NetworkLink } from '../types/link'
import type { GraphIssue, NetworkGraph } from '../types/graph'

/** Return value of {@link useNetworkGraph}. */
export interface UseNetworkGraphReturn<E, L> {
  graph: ComputedRef<NetworkGraph<E, L>>
  /** Everything the builder dropped or repaired in the current input. */
  issues: ComputedRef<readonly GraphIssue[]>
}

/**
 * Graph indexes derived from the input arrays.
 *
 * Recomputation is tied to the `entities` and `links` references: the `computed`
 * re-runs only when the consumer supplies a new array. Editing a field inside an
 * existing entity leaves the indexes alone — they do not depend on fields.
 *
 * Each entity's `meta` is marked `markRaw`: VueFlow makes `node.data` reactive,
 * and without this Vue would proxy every nested object of consumer data.
 * Reactivity is not wanted there — the details panel only reads it. It marks
 * `meta` specifically, never the entity: the rest belongs to the consumer.
 */
export function useNetworkGraph<E, L>(
  entities: Ref<NetworkEntity<E>[]>,
  links: Ref<NetworkLink<L>[]>,
): UseNetworkGraphReturn<E, L> {
  const built = computed(() => {
    const collected: GraphIssue[] = []
    const graph = buildGraph<E, L>(entities.value, links.value, {
      onIssue: (issue) => collected.push(issue),
    })

    for (const entity of graph.entities.values()) {
      if (entity.meta !== null && typeof entity.meta === 'object') markRaw(entity.meta)
    }

    // Cast: widening to `readonly` so callers cannot push into the array that
    // the `computed` keeps handing back.
    return { graph, issues: collected as readonly GraphIssue[] }
  })

  return {
    graph: computed(() => built.value.graph),
    issues: computed(() => built.value.issues),
  }
}
