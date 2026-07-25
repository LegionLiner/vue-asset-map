import type { EntityId, NetworkEntity } from '../types/entity'
import type { NetworkLink } from '../types/link'
import type { GraphIssue, NetworkGraph } from '../types/graph'

export interface BuildGraphOptions {
  /** Вызывается на каждую отброшенную/починенную запись входных данных. */
  onIssue?: (issue: GraphIssue) => void
}

/**
 * Строит индексы графа из плоских массивов.
 *
 * Чистая функция: входные массивы только читаются, ни одна сущность не
 * копируется и не мутируется (в карту складываются те же ссылки).
 *
 * Битые данные не роняют построение, а сообщаются через `onIssue`:
 *  - дубль id — побеждает первая запись;
 *  - ребро в несуществующую сущность — отбрасывается;
 *  - `parentId` в несуществующую сущность — узел становится корневым;
 *  - цикл в иерархии — связь с родителем разрывается у узла, замкнувшего цикл.
 */
export function buildGraph<E = unknown, L = unknown>(
  entities: readonly NetworkEntity<E>[],
  links: readonly NetworkLink<L>[],
  options: BuildGraphOptions = {},
): NetworkGraph<E, L> {
  const { onIssue } = options

  const entityMap = new Map<EntityId, NetworkEntity<E>>()
  for (const entity of entities) {
    if (entityMap.has(entity.id)) {
      onIssue?.({ code: 'duplicate-entity', id: entity.id, detail: 'first occurrence wins' })
      continue
    }
    entityMap.set(entity.id, entity)
  }

  const linkMap = new Map<string, NetworkLink<L>>()
  const adjacency = new Map<EntityId, EntityId[]>()
  const outgoing = new Map<EntityId, string[]>()
  const incoming = new Map<EntityId, string[]>()
  for (const id of entityMap.keys()) {
    adjacency.set(id, [])
    outgoing.set(id, [])
    incoming.set(id, [])
  }

  for (const link of links) {
    if (linkMap.has(link.id)) {
      onIssue?.({ code: 'duplicate-link', id: link.id, detail: 'first occurrence wins' })
      continue
    }
    if (!entityMap.has(link.source) || !entityMap.has(link.target)) {
      const missing = entityMap.has(link.source) ? link.target : link.source
      onIssue?.({ code: 'dangling-link', id: link.id, detail: `unknown entity ${missing}` })
      continue
    }
    linkMap.set(link.id, link)

    // Петля попадает в adjacency один раз: иначе кратность связи между двумя
    // разными узлами и «двойная» петля стали бы неразличимы.
    pushTo(adjacency, link.source, link.id)
    if (link.target !== link.source) pushTo(adjacency, link.target, link.id)
    pushTo(outgoing, link.source, link.id)
    pushTo(incoming, link.target, link.id)
  }

  const hierarchy = buildHierarchy(entityMap, onIssue)

  return {
    entities: entityMap,
    links: linkMap,
    adjacency,
    childrenOf: hierarchy.childrenOf,
    roots: hierarchy.roots,
    parentOf: hierarchy.parentOf,
    outgoing,
    incoming,
  }
}

function pushTo(index: Map<EntityId, string[]>, key: EntityId, value: string): void {
  const bucket = index.get(key)
  if (bucket) bucket.push(value)
  else index.set(key, [value])
}

interface Hierarchy {
  childrenOf: ReadonlyMap<EntityId, readonly EntityId[]>
  roots: readonly EntityId[]
  parentOf: ReadonlyMap<EntityId, EntityId | null>
}

function buildHierarchy<E>(
  entityMap: ReadonlyMap<EntityId, NetworkEntity<E>>,
  onIssue: BuildGraphOptions['onIssue'],
): Hierarchy {
  // Сначала — эффективный родитель каждого узла, с отсечением битых ссылок.
  const parentOf = new Map<EntityId, EntityId | null>()
  for (const entity of entityMap.values()) {
    const parentId = entity.parentId ?? null
    if (parentId === null) {
      parentOf.set(entity.id, null)
      continue
    }
    if (parentId === entity.id) {
      onIssue?.({ code: 'self-parent', id: entity.id })
      parentOf.set(entity.id, null)
      continue
    }
    if (!entityMap.has(parentId)) {
      onIssue?.({ code: 'missing-parent', id: entity.id, detail: `unknown parent ${parentId}` })
      parentOf.set(entity.id, null)
      continue
    }
    parentOf.set(entity.id, parentId)
  }

  // Затем — разрыв циклов. Идём в порядке входных данных, поэтому какая именно
  // связь в цикле разрывается, определено однозначно.
  for (const id of entityMap.keys()) {
    const seen = new Set<EntityId>([id])
    let cursor = parentOf.get(id) ?? null
    while (cursor !== null) {
      if (seen.has(cursor)) {
        onIssue?.({ code: 'parent-cycle', id: cursor, detail: `cycle through ${id}` })
        parentOf.set(cursor, null)
        break
      }
      seen.add(cursor)
      cursor = parentOf.get(cursor) ?? null
    }
  }

  const childrenOf = new Map<EntityId, EntityId[]>()
  const roots: EntityId[] = []
  for (const id of entityMap.keys()) {
    const parentId = parentOf.get(id) ?? null
    if (parentId === null) {
      roots.push(id)
      continue
    }
    const bucket = childrenOf.get(parentId)
    if (bucket) bucket.push(id)
    else childrenOf.set(parentId, [id])
  }

  return { childrenOf, roots, parentOf }
}

/** Эффективный родитель узла — уже с учётом починки битых ссылок и циклов. */
export function parentIdOf<E, L>(graph: NetworkGraph<E, L>, id: EntityId): EntityId | null {
  return graph.parentOf.get(id) ?? null
}

/** Цепочка предков от прямого родителя до корня. Циклобезопасно. */
export function ancestorsOf<E, L>(graph: NetworkGraph<E, L>, id: EntityId): EntityId[] {
  const chain: EntityId[] = []
  const seen = new Set<EntityId>([id])
  let cursor = parentIdOf(graph, id)
  while (cursor !== null && !seen.has(cursor)) {
    chain.push(cursor)
    seen.add(cursor)
    cursor = parentIdOf(graph, cursor)
  }
  return chain
}

/** Все потомки узла в порядке обхода в глубину. Циклобезопасно. */
export function descendantsOf<E, L>(graph: NetworkGraph<E, L>, id: EntityId): EntityId[] {
  const out: EntityId[] = []
  const seen = new Set<EntityId>([id])
  const stack: EntityId[] = [id]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break
    // Результат пишется при снятии со стека — иначе порядок был бы обратным
    // порядку обхода. Сам узел в список потомков не входит.
    if (current !== id) out.push(current)
    const children = graph.childrenOf.get(current) ?? []
    // Дети кладутся в обратном порядке, чтобы сниматься в прямом.
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i]
      if (child === undefined || seen.has(child)) continue
      seen.add(child)
      stack.push(child)
    }
  }
  return out
}

/** Инцидентные рёбра узла, опционально ограниченные слоями. */
export function incidentLinks<E, L>(
  graph: NetworkGraph<E, L>,
  id: EntityId,
  layers?: readonly string[],
): NetworkLink<L>[] {
  const ids = graph.adjacency.get(id) ?? []
  const out: NetworkLink<L>[] = []
  for (const linkId of ids) {
    const link = graph.links.get(linkId)
    if (!link) continue
    if (layers && !matchesLayers(link, layers)) continue
    out.push(link)
  }
  return out
}

export function matchesLayers(link: NetworkLink, layers: readonly string[]): boolean {
  if (layers.length === 0) return true
  return link.layers.some((layer) => layers.includes(layer))
}

/** Другой конец ребра относительно `id`. Для петли — сам `id`. */
export function otherEnd(link: NetworkLink, id: EntityId): EntityId {
  return link.source === id ? link.target : link.source
}

/** Пустой граф: удобно как начальное значение и в тестах. */
export function emptyGraph<E = unknown, L = unknown>(): NetworkGraph<E, L> {
  return buildGraph<E, L>([], [])
}
