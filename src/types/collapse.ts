import type { EntityId, NetworkEntity } from './entity'
import type { NetworkLink } from './link'

/** When to fold a set of siblings into one group node, and how to bucket them. */
export interface CollapseRule {
  /**
   * Collapse when a parent has more children than this.
   *
   * @default 10
   */
  threshold?: number
  /**
   * Bucket key within one parent; children sharing a key end up in one group.
   * Return `null` to keep an entity out of any group.
   *
   * @default entity kind
   */
  groupBy?: (entity: NetworkEntity) => string | null
  /** Overrides the threshold decision entirely. */
  shouldCollapse?: (parentId: EntityId | null, children: readonly NetworkEntity[]) => boolean
}

/** A group node standing in for several hidden siblings. */
export interface CollapsedGroup {
  /** Format: `group:<parentId>:<bucket>`. */
  id: string
  parentId: EntityId | null
  bucket: string
  memberIds: EntityId[]
  /** Links with both ends inside the group: not drawn, but counted here. */
  internalLinkCount: number
}

/** Several original links bundled into one edge between the same two nodes. */
export interface AggregatedLink<L = unknown> extends NetworkLink<L> {
  aggregated: true
  /** How many original links this edge stands for. */
  count: number
  sourceLinkIds: string[]
}

/** Edge of the collapsed graph: either a re-homed original or an aggregate. */
export type CollapsedLink<L = unknown> = NetworkLink<L> | AggregatedLink<L>

/** Output of `collapseGraph`: the graph layout and rendering actually receive. */
export interface CollapseResult<L = unknown> {
  groups: readonly CollapsedGroup[]
  /** Id of a member (or any of its descendants) → id of the group hiding it. */
  groupOf: ReadonlyMap<EntityId, string>
  /** Entities folded away into groups. */
  hiddenIds: ReadonlySet<EntityId>
  /** Nodes of the collapsed graph: entity ids plus group ids, in stable order. */
  nodeIds: readonly string[]
  links: readonly CollapsedLink<L>[]
}
