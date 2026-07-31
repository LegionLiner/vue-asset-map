import type { EntityId } from './entity'

/**
 * One edge of the map. Like entities, links are read-only for the library.
 *
 * @typeParam M - shape of the consumer's own payload in `meta`.
 */
export interface AssetLink<M = unknown> {
  id: string
  source: EntityId
  target: EntityId
  /** Layers this link belongs to; view projection filters on them. */
  layers: string[]
  /** Selects the edge style, e.g. `'solid'` or `'dashed'`. Open string union. */
  type?: string
  label?: string
  directed?: boolean
  /**
   * Which handle on each end the line attaches to.
   *
   * Only needed when a node draws more than one: a node component that renders
   * several sub-parts — slots in a rack, ports on a switch, rows in a card —
   * gives each its own handle, and these say which pair this link joins. Omitted,
   * the line lands on the node's first handle of the right type, which is what
   * every single-handle node wants.
   */
  sourceHandle?: string
  targetHandle?: string
  meta?: M
}
