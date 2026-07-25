import type { EntityId, AssetEntity } from '../types/entity'
import type { AssetLink } from '../types/link'
import type { GraphIssue, AssetGraph } from '../types/graph'

/** Options of {@link buildGraph}. */
export interface BuildGraphOptions {
  /** Called once per input record that was dropped or repaired. */
  onIssue?: (issue: GraphIssue) => void
}

/**
 * Builds the graph indexes out of the flat input arrays.
 *
 * Pure: the input arrays are only read, and entities are neither copied nor
 * mutated — the maps hold the very same references.
 *
 * Broken data never throws; it is reported through `onIssue` instead:
 *  - duplicate id — the first occurrence wins;
 *  - link to a missing entity — dropped;
 *  - `parentId` pointing at a missing entity — the node becomes a root;
 *  - cycle in the hierarchy — the parent link is cut at the node that closed it.
 */
export function buildGraph<E = unknown, L = unknown>(
  entities: readonly AssetEntity<E>[],
  links: readonly AssetLink<L>[],
  options: BuildGraphOptions = {},
): AssetGraph<E, L> {
  const { onIssue } = options

  const entityMap = new Map<EntityId, AssetEntity<E>>()
  for (const entity of entities) {
    if (entityMap.has(entity.id)) {
      onIssue?.({ code: 'duplicate-entity', id: entity.id, detail: 'first occurrence wins' })
      continue
    }
    entityMap.set(entity.id, entity)
  }

  const linkMap = new Map<string, AssetLink<L>>()
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

    // A self-loop is recorded once: otherwise a doubled loop would be
    // indistinguishable from two parallel links between distinct nodes.
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
  entityMap: ReadonlyMap<EntityId, AssetEntity<E>>,
  onIssue: BuildGraphOptions['onIssue'],
): Hierarchy {
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

  // Cycles are broken in input order, so which link of a cycle gets cut is
  // deterministic instead of depending on map iteration.
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

/** Effective parent of a node: `null` for a root and for any repaired hierarchy. */
export function parentIdOf<E, L>(graph: AssetGraph<E, L>, id: EntityId): EntityId | null {
  return graph.parentOf.get(id) ?? null
}

/** Ancestors from the direct parent up to the root. Cycle-safe. */
export function ancestorsOf<E, L>(graph: AssetGraph<E, L>, id: EntityId): EntityId[] {
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

/** Descendants in depth-first order, excluding the node itself. Cycle-safe. */
export function descendantsOf<E, L>(graph: AssetGraph<E, L>, id: EntityId): EntityId[] {
  const out: EntityId[] = []
  const seen = new Set<EntityId>([id])
  const stack: EntityId[] = [id]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break
    // Recorded on pop, not on push: pushing would reverse the traversal order.
    if (current !== id) out.push(current)
    const children = graph.childrenOf.get(current) ?? []
    // Children go on in reverse so they come off in declaration order.
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i]
      if (child === undefined || seen.has(child)) continue
      seen.add(child)
      stack.push(child)
    }
  }
  return out
}

/** Links incident to a node, optionally restricted to the given layers. */
export function incidentLinks<E, L>(
  graph: AssetGraph<E, L>,
  id: EntityId,
  layers?: readonly string[],
): AssetLink<L>[] {
  const ids = graph.adjacency.get(id) ?? []
  const out: AssetLink<L>[] = []
  for (const linkId of ids) {
    const link = graph.links.get(linkId)
    if (!link) continue
    if (layers && !matchesLayers(link, layers)) continue
    out.push(link)
  }
  return out
}

/** Whether a link sits on any of `layers`. Empty `layers` matches every link. */
export function matchesLayers(link: AssetLink, layers: readonly string[]): boolean {
  if (layers.length === 0) return true
  return link.layers.some((layer) => layers.includes(layer))
}

/** The far end of a link relative to `id`; a self-loop returns `id` itself. */
export function otherEnd(link: AssetLink, id: EntityId): EntityId {
  return link.source === id ? link.target : link.source
}

/** Graph with no entities and no links; useful as an initial value. */
export function emptyGraph<E = unknown, L = unknown>(): AssetGraph<E, L> {
  return buildGraph<E, L>([], [])
}
