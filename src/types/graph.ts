import type { EntityId, AssetEntity } from './entity'
import type { AssetLink } from './link'

/**
 * Indexed, repaired view of the input data. Built once per change of the
 * `entities` / `links` references and treated as immutable afterwards —
 * everything downstream (projection, filtering, collapsing, layout) reads it.
 *
 * @typeParam E - payload type of `entity.meta`.
 * @typeParam L - payload type of `link.meta`.
 */
export interface AssetGraph<E = unknown, L = unknown> {
  entities: ReadonlyMap<EntityId, AssetEntity<E>>
  links: ReadonlyMap<string, AssetLink<L>>
  /**
   * Entity id → ids of incident links.
   *
   * Every incident link appears exactly once, self-loops included
   * (`source === target` yields one entry, not two). Parallel links keep
   * distinct ids, so link multiplicity survives indexing.
   */
  adjacency: ReadonlyMap<EntityId, readonly string[]>
  childrenOf: ReadonlyMap<EntityId, readonly EntityId[]>
  roots: readonly EntityId[]
  /**
   * Entity id → effective parent (`null` for a root).
   *
   * "Effective" means post-repair: references to a missing parent and cycles in
   * the hierarchy are both flattened to `null`.
   */
  parentOf: ReadonlyMap<EntityId, EntityId | null>

  /** Entity id → ids of links where it is the source. Used for directed traversal. */
  outgoing: ReadonlyMap<EntityId, readonly string[]>
  /** Entity id → ids of links where it is the target. */
  incoming: ReadonlyMap<EntityId, readonly string[]>
}

/** What the graph builder dropped or repaired in the input data. */
export type GraphIssueCode =
  'duplicate-entity' | 'duplicate-link' | 'dangling-link' | 'missing-parent' | 'parent-cycle' | 'self-parent'

/** One repair report, delivered through `buildGraph`'s `onIssue` callback. */
export interface GraphIssue {
  code: GraphIssueCode
  /** Id of the offending entity or link. */
  id: string
  detail?: string
}
