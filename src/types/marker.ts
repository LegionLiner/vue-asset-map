import type { EntityId, AssetEntity } from './entity'
import type { AssetGraph } from './graph'

/**
 * A membership marker — the dot drawn under a node's label.
 *
 * Markers show the same groupings the links do, but readable at a glance:
 * nothing has to be clicked to see what belongs where. Hovering a dot
 * highlights every node carrying it.
 *
 * Membership is declared one of two ways:
 *  - `members` — the whole set at once, computed from the graph. Cheaper, and
 *    the right choice when membership follows from links: one traversal total;
 *  - `match` — a per-entity predicate. Simpler when membership is visible on the
 *    entity itself (a field in `meta`, its `kind`, its `status`).
 *
 * `members` wins when both are given.
 */
export interface NodeMarkerDef {
  id: string
  /** Fill color. Taken from the token palette by declaration order when omitted. */
  color?: string
  /** Screen-reader label and tooltip. Falls back to `id`. */
  label?: string
  /** The full member set. Called once per graph change. */
  members?: (graph: AssetGraph) => Iterable<EntityId>
  /** Whether an entity carries this marker. Called once per entity. */
  match?: (entity: AssetEntity, graph: AssetGraph) => boolean
}

/** A marker with its color already picked — what a node actually renders. */
export interface ResolvedNodeMarker {
  id: string
  color: string
  label: string
}

/** The node a connection-derived marker is built around. */
export interface MarkerAnchor {
  id: EntityId
  label?: string
  color?: string
}

/** Options for `connectionMarkers`. */
export interface ConnectionMarkerOptions {
  /**
   * How many steps out from the anchor still count as membership.
   *
   * @default 1
   */
  depth?: number
  /**
   * Restrict membership to links on these layers.
   *
   * Defaults to every layer on purpose: a node can be wired to a router
   * physically and to a VPN coordinator logically at the same time, and both
   * dots must stay visible regardless of which view is open.
   *
   * @default all layers
   */
  layers?: readonly string[]
  /**
   * Whether the anchor is a member of its own marker.
   *
   * @default true
   */
  includeAnchor?: boolean
}
