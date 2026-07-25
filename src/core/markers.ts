import type { EntityId } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { ConnectionMarkerOptions, MarkerAnchor, NodeMarkerDef } from '../types/marker'
import { neighbors } from './traverse'

/**
 * Builds membership markers out of the graph's own connections.
 *
 * Each anchor yields one marker, carried by everything connected to it. That is
 * why a workstation ends up with two dots: one for the router it is physically
 * plugged into, one for the VPN coordinator the overlay joins it to. Belonging
 * to one does not cancel the other.
 *
 * Membership is computed through `members` — one traversal per anchor per graph
 * change. A `match` predicate cannot do this job: it runs per entity, so the
 * traversal would repeat entities × markers times.
 *
 * @example
 * ```ts
 * const markers = connectionMarkers([
 *   { id: 'router-1', label: 'Office A' },
 *   { id: 'vpn-coordinator', label: 'VPN' },
 * ])
 * ```
 */
export function connectionMarkers(
  anchors: readonly MarkerAnchor[],
  options: ConnectionMarkerOptions = {},
): NodeMarkerDef[] {
  const { depth = 1, layers, includeAnchor = true } = options

  return anchors.map((anchor) => {
    const def: NodeMarkerDef = {
      id: anchor.id,
      members: (graph: AssetGraph) => membersOf(graph, anchor.id, depth, layers, includeAnchor),
    }
    if (anchor.label !== undefined) def.label = anchor.label
    if (anchor.color !== undefined) def.color = anchor.color
    return def
  })
}

function membersOf(
  graph: AssetGraph,
  anchorId: EntityId,
  depth: number,
  layers: readonly string[] | undefined,
  includeAnchor: boolean,
): Set<EntityId> {
  // `neighbors` hands back a fresh set, so adding the anchor is safe here.
  const members = neighbors(graph, anchorId, depth, layers)
  if (includeAnchor && graph.entities.has(anchorId)) members.add(anchorId)
  return members
}

/**
 * Picks the most connected nodes as anchors, skipping isolated ones.
 *
 * Useful when the hubs are not known up front: an asset map arrives from
 * inventory, and which node turns out to be central is visible only from the
 * data. Deterministic — nodes of equal degree keep their input order.
 *
 * @param count - how many anchors to return; `0` or less yields an empty list.
 */
export function topAnchors<E, L>(
  graph: AssetGraph<E, L>,
  count: number,
  layers?: readonly string[],
): MarkerAnchor[] {
  const scored: { id: EntityId; label: string; degree: number }[] = []

  for (const entity of graph.entities.values()) {
    const incident = graph.adjacency.get(entity.id) ?? []
    const degree =
      layers === undefined
        ? incident.length
        : incident.filter((linkId) => {
            const link = graph.links.get(linkId)
            return link ? link.layers.some((layer) => layers.includes(layer)) : false
          }).length

    if (degree > 0) scored.push({ id: entity.id, label: entity.label, degree })
  }

  // Array#sort is stable per spec, which is what keeps equal degrees in input
  // order.
  scored.sort((a, b) => b.degree - a.degree)

  return scored.slice(0, Math.max(0, count)).map(({ id, label }) => ({ id, label }))
}
