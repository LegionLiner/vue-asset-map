import type { EntityId, NetworkEntity } from './entity'

/** Current filter selection. Owned by the consumer through `v-model:filters`. */
export interface FilterState {
  query: string
  /** Empty array means every kind. */
  kinds: string[]
  statuses: string[]
  predicate?: (entity: NetworkEntity) => boolean
  /**
   * Selection in consumer-defined groups: group id → chosen values.
   *
   * The package does not know what a "subnet" or a "severity" is: groups are
   * declared in `FilterOptions.groups`, and only the selection lives here.
   */
  groups?: Record<string, string[]>
}

/** One selectable value inside a filter group. */
export interface FilterGroupOption {
  value: string
  /** Falls back to the raw `value` when omitted. */
  label?: string
}

/**
 * Declaration of a filter group.
 *
 * Groups are data, not code: "Subnet", "Asset type" and "Severity" all come
 * from the consumer. The package only collects values out of the entities and
 * matches the selection against them.
 */
export interface FilterGroupDef {
  id: string
  label: string
  /** Fixed value list. Collected from the data via `valuesOf` when omitted. */
  options?: readonly FilterGroupOption[]
  /**
   * Which values of this group an entity carries.
   *
   * Drives value collection, facet counts and matching alike, so one function
   * is enough to describe a group.
   *
   * @default entity kind
   */
  valuesOf?: (entity: NetworkEntity) => readonly string[]
  /**
   * Whether the group starts expanded.
   *
   * @default true
   */
  defaultOpen?: boolean
}

/** Output of `filterGraph`. */
export interface FilterResult {
  /** Direct hits — these get highlighted. */
  matchedIds: Set<EntityId>
  /** Everything that stays on the map, hits and kept context alike. */
  visibleIds: Set<EntityId>
}

export interface FilterOptions {
  /**
   * Keep neighbours of matched nodes up to this many steps away.
   *
   * @default 1
   */
  neighborDepth?: number
  /**
   * Keep the chain up to the root so the graph does not fall apart.
   *
   * @default true
   */
  keepPathToRoot?: boolean
  /**
   * Fields the text query is matched against.
   *
   * @default label plus sublabels
   */
  searchFields?: (entity: NetworkEntity) => string[]
  /**
   * Restrict filtering to a subgraph, normally the current view projection.
   *
   * @default the whole graph
   */
  restrictTo?: ReadonlySet<EntityId>
  /**
   * Expand to neighbours only across links on these layers.
   *
   * @default all layers
   */
  layers?: readonly string[]
  /** Consumer-defined groups the selection narrows by. */
  groups?: readonly FilterGroupDef[]
}

/** How many entities fall under each facet value; used for the counters in the UI. */
export interface FacetCounts {
  kinds: ReadonlyMap<string, number>
  statuses: ReadonlyMap<string, number>
  /** Group id → value → entity count. */
  groups: ReadonlyMap<string, ReadonlyMap<string, number>>
}
