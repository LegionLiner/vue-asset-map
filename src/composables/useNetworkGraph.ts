import { computed, markRaw, type ComputedRef, type Ref } from 'vue'
import { buildGraph } from '../core/graph'
import type { NetworkEntity } from '../types/entity'
import type { NetworkLink } from '../types/link'
import type { GraphIssue, NetworkGraph } from '../types/graph'

export interface UseNetworkGraphReturn<E, L> {
  graph: ComputedRef<NetworkGraph<E, L>>
  issues: ComputedRef<readonly GraphIssue[]>
}

/**
 * Индексы графа из входных массивов.
 *
 * Пересчёт привязан к ссылкам на `entities` и `links`: `computed`
 * перевычисляется, только когда потребитель подставил новый массив. Правка поля
 * внутри существующей сущности индексы не трогает — они от полей не зависят.
 *
 * `meta` каждой сущности помечается `markRaw`: VueFlow делает `node.data`
 * реактивным, и без этого Vue навесил бы прокси на каждый вложенный объект
 * прикладных данных. Реактивность там не нужна — панель подробностей их только
 * читает. Помечается именно `meta`, а не сама сущность: остальное принадлежит
 * потребителю, и трогать это мы не имеем права.
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

    return { graph, issues: collected as readonly GraphIssue[] }
  })

  return {
    graph: computed(() => built.value.graph),
    issues: computed(() => built.value.issues),
  }
}
