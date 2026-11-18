import type { EntityId, AssetEntity } from './entity'
import type { AssetLink } from './link'

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
   * @default entity type
   */
  groupBy?: (entity: AssetEntity) => string | null
  /** Overrides the threshold decision entirely. */
  shouldCollapse?: (parentId: EntityId | null, children: readonly AssetEntity[]) => boolean
  /**
   * How many members an expanded group puts on the map at a time.
   *
   * The rest wait in a "more" node that reveals the next page each time it is
   * opened, so unfolding a group of thousands does not mount thousands of nodes
   * in one go. `0` reveals every member at once.
   *
   * @default 200
   */
  pageSize?: number
}

/** A group node standing in for several hidden siblings. */
export interface CollapsedGroup {
  /** Format: `group:<parentId>:<bucket>`; a "more" node appends `@more:<offset>`. */
  id: string
  parentId: EntityId | null
  bucket: string
  memberIds: EntityId[]
  /** Links with both ends inside the group: not drawn, but counted here. */
  internalLinkCount: number
  /**
   * Set on a "more" node: the id of the expanded group whose remaining members
   * it holds. Opening it reveals the next `CollapseRule.pageSize` of them.
   */
  remainderOf?: string
  /** On a "more" node: original offset of the first page still folded. */
  offset?: number
}

/** Several original links bundled into one edge between the same two nodes. */
export interface AggregatedLink<L = unknown> extends AssetLink<L> {
  aggregated: true
  /** How many original links this edge stands for. */
  count: number
  sourceLinkIds: string[]
}

/** Edge of the collapsed graph: either a re-homed original or an aggregate. */
export type CollapsedLink<L = unknown> = AssetLink<L> | AggregatedLink<L>

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
