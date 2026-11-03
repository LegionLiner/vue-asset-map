import { computed, markRaw, shallowRef, type ComputedRef, type Ref } from 'vue'
import { buildGraph } from '../core/graph'
import type { AssetEntity, EntityId } from '../types/entity'
import type { AssetLink } from '../types/link'
import type { GraphIssue, AssetGraph } from '../types/graph'

/** Return value of {@link useAssetGraph}. */
export interface UseAssetGraphReturn<E, L> {
  graph: ComputedRef<AssetGraph<E, L>>
  /** Everything the builder dropped or repaired in the current input. */
  issues: ComputedRef<readonly GraphIssue[]>
  /**
   * Replaces one entity by id without the arrays changing.
   *
   * For an application that keeps its records outside Vue's reactivity
   * (`shallowRef`, `markRaw`) and would rather say "this one changed" than hand
   * over a new array of a hundred thousand. The entity must already be in the
   * graph and keep its `parentId`; anything structural — adding, removing,
   * re-parenting — goes through the arrays. Returns whether it was applied.
   *
   * Pass a new object: the record already in the graph, mutated in place, is
   * indistinguishable from no change at all. The replacement lasts until the
   * `entities` array changes, at which point it is the source of truth again.
   */
  updateEntity: (entity: AssetEntity<E>) => boolean
}

/**
 * Graph indexes derived from the input arrays.
 *
 * Recomputation is tied to the `entities` and `links` references: the `computed`
 * re-runs only when the consumer supplies a new array. Editing a field inside an
 * existing entity leaves the indexes alone — they do not depend on fields.
 *
 * A new array is not necessarily a new structure. Moving one asset hands the map
 * a fresh array where every id and parent is where it was; rebuilding adjacency
 * and hierarchy for that is wasted work. So the previous build is compared first
 * and, when only the records changed, its structural indexes are reused and
 * only the id → record maps are rebuilt.
 *
 * Each entity's `meta` is marked `markRaw`: VueFlow makes `node.data` reactive,
 * and without this Vue would proxy every nested object of consumer data.
 * Reactivity is not wanted there — the details panel only reads it. It marks
 * `meta` specifically, never the entity: the rest belongs to the consumer.
 */
export function useAssetGraph<E, L>(
  entities: Ref<AssetEntity<E>[]>,
  links: Ref<AssetLink<L>[]>,
): UseAssetGraphReturn<E, L> {
  interface Build {
    graph: AssetGraph<E, L>
    issues: readonly GraphIssue[]
    entities: readonly AssetEntity<E>[]
    links: readonly AssetLink<L>[]
  }

  /** The last build from the arrays alone, before any point replacement. */
  let base: Build | undefined

  /** Point replacements, keyed by id, and the entities array they were made against. */
  const patches = shallowRef<ReadonlyMap<EntityId, AssetEntity<E>>>(new Map())
  let patchedArray: readonly AssetEntity<E>[] | undefined

  const markMeta = (entity: AssetEntity<E>): void => {
    if (entity.meta !== null && typeof entity.meta === 'object') markRaw(entity.meta)
  }

  const built = computed<Build>(() => {
    const nextEntities = entities.value
    const nextLinks = links.value
    const pending = patches.value

    const reused = base ? reuse(base, nextEntities, nextLinks) : undefined
    if (reused !== base || !base) {
      let build = reused
      if (!build) {
        const collected: GraphIssue[] = []
        const graph = buildGraph<E, L>(nextEntities, nextLinks, {
          onIssue: (issue) => collected.push(issue),
        })
        // Cast: widening to `readonly` so callers cannot push into the array
        // that the `computed` keeps handing back.
        build = {
          graph,
          issues: collected as readonly GraphIssue[],
          entities: nextEntities,
          links: nextLinks,
        }
      }
      if (build.graph.entities !== base?.graph.entities) {
        for (const entity of build.graph.entities.values()) markMeta(entity)
      }
      base = build
    }

    // A new entities array carries its own truth, and the replacements made
    // against the old one lapse.
    if (pending.size === 0 || patchedArray !== nextEntities) return base

    const entityMap = new Map(base.graph.entities)
    for (const [id, entity] of pending) {
      if (!entityMap.has(id)) continue
      markMeta(entity)
      entityMap.set(id, entity)
    }
    return { ...base, graph: { ...base.graph, entities: entityMap } }
  })

  const updateEntity = (entity: AssetEntity<E>): boolean => {
    const existing = built.value.graph.entities.get(entity.id)
    if (!existing) return false
    // A different parent moves the node in the hierarchy, which the indexes
    // built from the arrays know nothing about.
    if ((existing.parentId ?? null) !== (entity.parentId ?? null)) return false
    if (existing === entity) return true

    const next = new Map(patchedArray === entities.value ? patches.value : [])
    next.set(entity.id, entity)
    patchedArray = entities.value
    patches.value = next
    return true
  }

  return {
    graph: computed(() => built.value.graph),
    issues: computed(() => built.value.issues),
    updateEntity,
  }
}

/**
 * The previous build's structure, carried over to new arrays when it still
 * describes them, or `undefined` when it does not.
 *
 * "Structure" is what the indexes are made of: entity ids and parents in order,
 * link ids and ends in order. Everything else — labels, statuses, positions,
 * `meta`, a link's layers — lives on the records and is picked up by rebuilding
 * only the id → record maps. Comparing costs one pass with no allocation, against
 * the several maps and the hierarchy walk a full build makes.
 */
function reuse<E, L>(
  previous: {
    graph: AssetGraph<E, L>
    issues: readonly GraphIssue[]
    entities: readonly AssetEntity<E>[]
    links: readonly AssetLink<L>[]
  },
  entities: readonly AssetEntity<E>[],
  links: readonly AssetLink<L>[],
): typeof previous | undefined {
  if (previous.entities === entities && previous.links === links) return previous

  const entitiesSame = previous.entities === entities
  const linksSame = previous.links === links

  if (!entitiesSame && !sameEntityStructure(previous.entities, entities)) return undefined
  if (!linksSame && !sameLinkStructure(previous.links, links)) return undefined

  let entityMap = previous.graph.entities
  if (!entitiesSame) {
    // Same ids in the same order, so "first occurrence wins" keeps exactly the
    // records the full build would.
    const next = new Map<EntityId, AssetEntity<E>>()
    for (const entity of entities) {
      if (!next.has(entity.id)) next.set(entity.id, entity)
    }
    entityMap = next
  }

  let linkMap = previous.graph.links
  if (!linksSame) {
    // Same ids and ends, so the links the full build dropped as dangling or
    // duplicate are exactly the ones absent from the previous map.
    const next = new Map<string, AssetLink<L>>()
    for (const link of links) {
      if (!next.has(link.id) && previous.graph.links.has(link.id)) next.set(link.id, link)
    }
    linkMap = next
  }

  return {
    graph: { ...previous.graph, entities: entityMap, links: linkMap },
    issues: previous.issues,
    entities,
    links,
  }
}

function sameEntityStructure<E>(a: readonly AssetEntity<E>[], b: readonly AssetEntity<E>[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (left === right) continue
    if (!left || !right) return false
    if (left.id !== right.id || (left.parentId ?? null) !== (right.parentId ?? null)) return false
  }
  return true
}

function sameLinkStructure<L>(a: readonly AssetLink<L>[], b: readonly AssetLink<L>[]): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (left === right) continue
    if (!left || !right) return false
    if (left.id !== right.id || left.source !== right.source || left.target !== right.target) return false
  }
  return true
}
