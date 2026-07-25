import type { EntityId } from './entity'

/**
 * One edge of the map. Like entities, links are read-only for the library.
 *
 * @typeParam M - shape of the consumer's own payload in `meta`.
 */
export interface NetworkLink<M = unknown> {
  id: string
  source: EntityId
  target: EntityId
  /** Layers this link belongs to; view projection filters on them. */
  layers: string[]
  /** Selects the edge style, e.g. `'solid'` or `'dashed'`. Open string union. */
  kind?: string
  label?: string
  directed?: boolean
  meta?: M
}
