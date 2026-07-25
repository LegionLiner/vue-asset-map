import type { EntityId, AssetEntity } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { AssetLink } from '../types/link'
import type {
  AggregatedLink,
  CollapsedGroup,
  CollapsedLink,
  CollapseResult,
  CollapseRule,
} from '../types/collapse'
import { descendantsOf } from './graph'

/** Options of {@link collapseGraph}. */
export interface CollapseOptions {
  /** `false` turns collapsing off entirely. */
  rule?: CollapseRule | false
  /** Groups expanded by hand; overrides the automatic rule. */
  expandedIds?: ReadonlySet<string>
  /** Entities allowed through, normally the projection and filter result. */
  visibleEntityIds?: ReadonlySet<EntityId>
  /** Links allowed through, normally the projection result. */
  visibleLinkIds?: ReadonlySet<string>
  /**
   * Parents whose subtree is hidden by the button on the node itself.
   *
   * Different from `expandedIds`: that one talks about synthetic group nodes,
   * this one about a real entity that stays on the map while its descendants
   * fold into it. Their links are re-homed onto the parent by the same rules
   * that apply to a group node.
   */
  collapsedParentIds?: ReadonlySet<EntityId>
}

const DEFAULT_THRESHOLD = 10

/**
 * Separator for the composite edge-bundle keys.
 *
 * U+0000 rather than `:` or a space: entity ids are arbitrary consumer strings
 * and may contain any printable character, so joining on a printable separator
 * would let distinct pairs collide on one key.
 */
const KEY_SEPARATOR = '\u0000'

/** Whether an edge of the collapsed graph stands for several original links. */
export function isAggregatedLink<L>(link: AssetLink<L>): link is AggregatedLink<L> {
  // Cast: `aggregated` is absent from the `AssetLink` half of the union, and
  // probing for it is exactly what this guard exists to do.
  return (link as { aggregated?: unknown }).aggregated === true
}

/** Group id in the form `group:<parentId>:<bucket>`; `parentId` is empty at root. */
export function groupIdFor(parentId: EntityId | null, bucket: string): string {
  return `group:${parentId ?? ''}:${bucket}`
}

const defaultGroupBy = (entity: AssetEntity): string | null => entity.kind

/**
 * Folds oversized sets of same-kind siblings into single group nodes and
 * re-routes their edges. Runs before layout: positions are computed on the
 * collapsed graph, never on the original one.
 *
 * Pure and deterministic — group, node and edge order all follow the order of
 * the input arrays, so identical input yields identical output.
 *
 * Invariants worth knowing:
 *  - Grouping happens under the nearest *visible* ancestor. When a projection
 *    hides a parent, its children group one level up, not under a hidden id.
 *  - Levels are walked top-down, and a collapsed level is not descended into, so
 *    groups never nest inside other groups.
 *  - `expandedIds` is checked before the rule, so expanding by hand always beats
 *    both `shouldCollapse` and the threshold.
 *  - Member edges move onto the group node. Parallel edges collapse into an
 *    `AggregatedLink` only when at least one end is a group, so genuine link
 *    multiplicity between ordinary nodes stays visible.
 *  - An edge with both ends inside one group is not drawn; it is counted in
 *    `CollapsedGroup.internalLinkCount` instead.
 */
export function collapseGraph<E, L>(
  graph: AssetGraph<E, L>,
  options: CollapseOptions = {},
): CollapseResult<L> {
  const { rule, expandedIds, visibleEntityIds, visibleLinkIds, collapsedParentIds } = options

  const inProjection = (id: EntityId): boolean => visibleEntityIds === undefined || visibleEntityIds.has(id)

  // Resolved before any other decision: descendants of a collapsed parent must
  // neither be grouped nor reach the node list.
  const subtreeHidden = hiddenBySubtree(graph, collapsedParentIds, inProjection)

  const isEntityVisible = (id: EntityId): boolean => inProjection(id) && !subtreeHidden.has(id)

  const visibleEntities: AssetEntity<E>[] = []
  for (const entity of graph.entities.values()) {
    if (isEntityVisible(entity.id)) visibleEntities.push(entity)
  }

  // Ends are checked against the projection, not against final visibility: an
  // edge of a hidden descendant is re-homed onto its collapsed parent, not lost.
  const visibleLinks: AssetLink<L>[] = []
  for (const link of graph.links.values()) {
    if (visibleLinkIds !== undefined && !visibleLinkIds.has(link.id)) continue
    if (!inProjection(link.source) || !inProjection(link.target)) continue
    visibleLinks.push(link)
  }

  // Descendants of a collapsed parent address the parent itself, the same way
  // group members address their group node.
  const groupOf = new Map<EntityId, string>(subtreeHidden)
  const hiddenIds = new Set<EntityId>(subtreeHidden.keys())

  if (rule === false) {
    return {
      groups: [],
      groupOf,
      hiddenIds,
      nodeIds: visibleEntities.map((entity) => entity.id),
      links: remapLinks(visibleLinks, groupOf, new Set(), [], collapsedParentIds),
    }
  }

  // `undefined` means "default rule"; only `false` disables collapsing. Same
  // reading as the `collapse` prop of <AssetMap>.
  const groups = decideGroups(graph, visibleEntities, rule ?? {}, expandedIds, isEntityVisible)
  const groupIds = new Set(groups.map((group) => group.id))
  indexMembers(graph, groups, groupOf, hiddenIds)

  const nodeIds = orderNodes(visibleEntities, groupOf, hiddenIds)
  const links = remapLinks(visibleLinks, groupOf, groupIds, groups, collapsedParentIds)

  return { groups, groupOf, hiddenIds, nodeIds, links }
}

/** Nearest ancestor that is still visible, or `null` when there is none. */
function visibleParentOf<E, L>(
  graph: AssetGraph<E, L>,
  id: EntityId,
  isEntityVisible: (id: EntityId) => boolean,
): EntityId | null {
  let cursor = graph.parentOf.get(id) ?? null
  const seen = new Set<EntityId>([id])
  while (cursor !== null && !seen.has(cursor)) {
    if (isEntityVisible(cursor)) return cursor
    seen.add(cursor)
    cursor = graph.parentOf.get(cursor) ?? null
  }
  return null
}

/** Returns the groups in discovery order, walking the hierarchy top-down. */
function decideGroups<E, L>(
  graph: AssetGraph<E, L>,
  visibleEntities: readonly AssetEntity<E>[],
  rule: CollapseRule,
  expandedIds: ReadonlySet<string> | undefined,
  isEntityVisible: (id: EntityId) => boolean,
): CollapsedGroup[] {
  const threshold = rule.threshold ?? DEFAULT_THRESHOLD
  const groupBy = rule.groupBy ?? defaultGroupBy

  // Keyed by effective visible parent; the `null` key holds the top level.
  const childrenByParent = new Map<EntityId | null, AssetEntity<E>[]>()
  for (const entity of visibleEntities) {
    const parentId = visibleParentOf(graph, entity.id, isEntityVisible)
    const bucket = childrenByParent.get(parentId)
    if (bucket) bucket.push(entity)
    else childrenByParent.set(parentId, [entity])
  }

  const groups: CollapsedGroup[] = []
  // Indexed instead of `shift()`: `null` is a legal queue item (the top level)
  // and must not be confused with an exhausted queue.
  const queue: (EntityId | null)[] = [null]
  const processed = new Set<EntityId | null>()

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const parentId = queue[cursor] ?? null
    if (processed.has(parentId)) continue
    processed.add(parentId)

    const children = childrenByParent.get(parentId) ?? []
    const buckets = new Map<string, AssetEntity<E>[]>()
    const ungrouped: AssetEntity<E>[] = []

    for (const child of children) {
      const bucket = groupBy(child)
      // `null` from groupBy means "never group this node".
      if (bucket === null) {
        ungrouped.push(child)
        continue
      }
      const members = buckets.get(bucket)
      if (members) members.push(child)
      else buckets.set(bucket, [child])
    }

    for (const [bucket, members] of buckets) {
      const groupId = groupIdFor(parentId, bucket)
      const collapsed =
        // A group of one hides a node behind a node and saves nothing. This
        // floor outranks `shouldCollapse`.
        members.length >= 2 &&
        !expandedIds?.has(groupId) &&
        (rule.shouldCollapse ? rule.shouldCollapse(parentId, members) : members.length > threshold)

      if (collapsed) {
        groups.push({
          id: groupId,
          parentId,
          bucket,
          memberIds: members.map((member) => member.id),
          internalLinkCount: 0,
        })
        // Member subtrees go inside the group wholesale, so stop descending.
        continue
      }
      for (const member of members) queue.push(member.id)
    }

    for (const child of ungrouped) queue.push(child.id)
  }

  return groups
}

/**
 * Descendant → id of the collapsed parent hiding it.
 *
 * Iterates in input order, so with nested collapsed parents the one closest to
 * the root wins and the result is unambiguous.
 */
function hiddenBySubtree<E, L>(
  graph: AssetGraph<E, L>,
  collapsedParentIds: ReadonlySet<EntityId> | undefined,
  inProjection: (id: EntityId) => boolean,
): Map<EntityId, EntityId> {
  const hidden = new Map<EntityId, EntityId>()
  if (!collapsedParentIds || collapsedParentIds.size === 0) return hidden

  for (const parentId of graph.entities.keys()) {
    if (!collapsedParentIds.has(parentId)) continue
    if (!inProjection(parentId)) continue
    // An already hidden parent hides nobody: its subtree is inside an ancestor
    // that is collapsed further up.
    if (hidden.has(parentId)) continue

    for (const descendant of descendantsOf(graph, parentId)) {
      if (hidden.has(descendant)) continue
      hidden.set(descendant, parentId)
    }
  }

  return hidden
}

/** Mutates `groupOf` and `hiddenIds`, adding group members and their subtrees. */
function indexMembers<E, L>(
  graph: AssetGraph<E, L>,
  groups: readonly CollapsedGroup[],
  groupOf: Map<EntityId, string>,
  hiddenIds: Set<EntityId>,
): void {
  for (const group of groups) {
    for (const memberId of group.memberIds) {
      if (!groupOf.has(memberId)) {
        groupOf.set(memberId, group.id)
        hiddenIds.add(memberId)
      }
      for (const descendant of descendantsOf(graph, memberId)) {
        if (groupOf.has(descendant)) continue
        groupOf.set(descendant, group.id)
        hiddenIds.add(descendant)
      }
    }
  }
}

/**
 * A group node takes the slot of its first member, which keeps node order tied
 * to the input arrays rather than to group discovery.
 */
function orderNodes<E>(
  visibleEntities: readonly AssetEntity<E>[],
  groupOf: ReadonlyMap<EntityId, string>,
  hiddenIds: ReadonlySet<EntityId>,
): string[] {
  const nodeIds: string[] = []
  const emitted = new Set<string>()

  for (const entity of visibleEntities) {
    if (!hiddenIds.has(entity.id)) {
      nodeIds.push(entity.id)
      continue
    }
    const groupId = groupOf.get(entity.id)
    if (groupId === undefined || emitted.has(groupId)) continue
    emitted.add(groupId)
    nodeIds.push(groupId)
  }

  return nodeIds
}

interface LinkBundle<L> {
  source: string
  target: string
  links: AssetLink<L>[]
}

/** Mutates `internalLinkCount` on the groups passed in. */
function remapLinks<L>(
  visibleLinks: readonly AssetLink<L>[],
  groupOf: ReadonlyMap<EntityId, string>,
  groupIds: ReadonlySet<string>,
  groups: readonly CollapsedGroup[],
  collapsedParentIds: ReadonlySet<EntityId> | undefined,
): CollapsedLink<L>[] {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const bundles = new Map<string, LinkBundle<L>>()

  for (const link of visibleLinks) {
    const source = groupOf.get(link.source) ?? link.source
    const target = groupOf.get(link.target) ?? link.target
    const remapped = groupOf.has(link.source) || groupOf.has(link.target)

    if (source === target) {
      if (remapped) {
        // Both ends landed inside one group or one collapsed subtree: the loop
        // is not drawn, and for a group it is counted instead.
        const group = groupById.get(source)
        if (group) group.internalLinkCount += 1
        continue
      }
      // A genuine self-loop on an ordinary node stays an edge.
    }

    const key = bundleKey(source, target, link)
    const bundle = bundles.get(key)
    if (bundle) bundle.links.push(link)
    else bundles.set(key, { source, target, links: [link] })
  }

  const out: CollapsedLink<L>[] = []
  for (const bundle of bundles.values()) {
    const first = bundle.links[0]
    if (first === undefined) continue

    if (bundle.links.length === 1) {
      out.push(
        first.source === bundle.source && first.target === bundle.target
          ? first
          : { ...first, source: bundle.source, target: bundle.target },
      )
      continue
    }

    // Only bundles created by collapsing are aggregated: both a group and a
    // collapsed parent gather the edges of the nodes they hide.
    const touchesCollapsed =
      groupIds.has(bundle.source) ||
      groupIds.has(bundle.target) ||
      collapsedParentIds?.has(bundle.source) === true ||
      collapsedParentIds?.has(bundle.target) === true

    if (!touchesCollapsed) {
      out.push(...bundle.links)
      continue
    }

    out.push(aggregate(bundle, first))
  }

  return out
}

/**
 * Bundle key. Undirected ends are normalised so `a→b` and `b→a` share a bundle;
 * `kind` and direction stay separate, or an aggregate would lose its edge style.
 */
function bundleKey<L>(source: string, target: string, link: AssetLink<L>): string {
  const kind = link.kind ?? ''
  if (link.directed === true) return ['d', source, target, kind].join(KEY_SEPARATOR)
  const [a, b] = source <= target ? [source, target] : [target, source]
  return ['u', a, b, kind].join(KEY_SEPARATOR)
}

function aggregate<L>(bundle: LinkBundle<L>, first: AssetLink<L>): AggregatedLink<L> {
  const layers = new Set<string>()
  const sourceLinkIds: string[] = []
  for (const link of bundle.links) {
    for (const layer of link.layers) layers.add(layer)
    sourceLinkIds.push(link.id)
  }

  const aggregated: AggregatedLink<L> = {
    id: `agg:${bundle.source}->${bundle.target}#${first.kind ?? ''}`,
    source: bundle.source,
    target: bundle.target,
    // Sorted for determinism: layer order must not depend on the order the
    // original links arrived in.
    layers: [...layers].sort(),
    aggregated: true,
    count: bundle.links.length,
    sourceLinkIds,
  }
  if (first.kind !== undefined) aggregated.kind = first.kind
  if (first.directed !== undefined) aggregated.directed = first.directed
  return aggregated
}
