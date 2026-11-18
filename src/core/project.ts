import type { EntityId } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { AssetLink } from '../types/link'
import type { AssetView, ProjectionResult } from '../types/view'

/** Default link filter of a view: the link carries a layer named like the view. */
export function defaultLinkFilter(view: AssetView): (link: AssetLink) => boolean {
  return (link) => link.layers.includes(view.id)
}

/**
 * Applies a view to the graph, yielding what may appear on the map.
 *
 * The order is fixed and observable: `entityFilter` picks candidate entities,
 * then `linkFilter` (by layer unless overridden) keeps only links whose *both*
 * ends survived, and only then `hideIsolated` drops entities left without a
 * single visible link.
 *
 * `hideIsolated` is literal: no incident visible link, no node. Ancestors do not
 * rescue descendants or the other way round — the hierarchy plays no part in
 * projection at all. It belongs to collapsing, and search keeps the map
 * connected through the filter's own `keepPathToRoot`.
 *
 * With no view everything is visible.
 */
export function projectGraph<E, L>(
  graph: AssetGraph<E, L>,
  view?: AssetView,
  linkFilter?: (link: AssetLink<L>) => boolean,
): ProjectionResult {
  const entityIds = new Set<EntityId>()
  for (const entity of graph.entities.values()) {
    if (view?.entityFilter && !view.entityFilter(entity)) continue
    entityIds.add(entity.id)
  }

  const viewFilter = view ? (view.linkFilter ?? defaultLinkFilter(view)) : undefined
  const linkIds = new Set<string>()
  const connected = new Set<EntityId>()
  for (const link of graph.links.values()) {
    if (!entityIds.has(link.source) || !entityIds.has(link.target)) continue
    if (viewFilter && !viewFilter(link)) continue
    if (linkFilter && !linkFilter(link)) continue
    linkIds.add(link.id)
    connected.add(link.source)
    connected.add(link.target)
  }

  if (!view?.hideIsolated) return { entityIds, linkIds }

  const kept = new Set<EntityId>()
  for (const id of entityIds) {
    if (connected.has(id)) kept.add(id)
  }
  return { entityIds: kept, linkIds }
}

/**
 * Looks a view up by id. Both a missing and an unknown id fall back to the first
 * view: the map must always render something, even when handed a bad id.
 */
export function resolveView(
  views: readonly AssetView[] | undefined,
  viewId: string | undefined,
): AssetView | undefined {
  if (!views || views.length === 0) return undefined
  if (viewId === undefined) return views[0]
  return views.find((view) => view.id === viewId) ?? views[0]
}
