import type { AssetEntity } from './entity'
import type { AssetLink } from './link'

/**
 * A projection of the graph: which entities and links are on screen, and how
 * they are laid out. Views are data — the library ships none of its own.
 */
export interface AssetView {
  id: string
  label: string
  /** @default `link.layers.includes(view.id)` */
  linkFilter?: (link: AssetLink) => boolean
  entityFilter?: (entity: AssetEntity) => boolean
  /** Whether nodes show their `sublabels` in this view. */
  showSublabels?: boolean
  layout?: { engine: string; options?: unknown }
  /** Drop nodes that have no links left after `linkFilter`. */
  hideIsolated?: boolean
}

/** What a view lets through. Ids not listed here are not rendered at all. */
export interface ProjectionResult {
  entityIds: ReadonlySet<string>
  linkIds: ReadonlySet<string>
}
