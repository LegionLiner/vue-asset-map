/** Identifier of an entity, unique across the whole dataset. */
export type EntityId = string

/** Point in canvas coordinates, in px — not screen coordinates. */
export interface XY {
  x: number
  y: number
}

/** Small marker drawn on top of a node, e.g. a vulnerability count or an alert. */
export interface Badge {
  id: string
  /** CSS color or a theme token name. */
  color?: string
  tooltip?: string
}

/**
 * One node of the map. The library treats every field except `id` as
 * presentation data and never writes to it — entities passed in as props are
 * read-only.
 *
 * @typeParam M - shape of the consumer's own payload in `meta`.
 */
export interface AssetEntity<M = unknown> {
  id: EntityId
  /**
   * Selects the icon and the render component. An open string union: any value
   * is valid, unknown types fall back to the default node.
   */
  type: string
  label: string
  /** Extra lines under the label: IP, domain, FQDN. */
  sublabels?: string[]
  /** State indicator, mapped to a color through `themeConfig.statusColors`. */
  status?: string
  badges?: Badge[]
  /** Hierarchy used for grouping and collapsing. */
  parentId?: EntityId | null
  /** Pinned position; takes priority over whatever the layout engine computes. */
  position?: XY
  /** Consumer payload. Wrapped in `markRaw` internally — it is never made reactive. */
  meta?: M
}
