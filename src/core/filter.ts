import type { EntityId, AssetEntity } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { FacetCounts, FilterGroupDef, FilterOptions, FilterResult, FilterState } from '../types/filter'
import { ancestorsOf, matchesLayers, otherEnd } from './graph'
import {
  cidrContains,
  isIPv4Wildcard,
  matchesCidr,
  matchesWildcard,
  parseCidr,
  parseIPv4,
  wildcardToRegExp,
} from './ip'

const DEFAULT_NEIGHBOR_DEPTH = 1

/** Filter state with nothing selected — the initial value for `v-model:filters`. */
export function emptyFilterState(): FilterState {
  return { query: '', types: [], statuses: [] }
}

/** Whether any criterion is set. While `false`, the whole graph stays visible. */
export function isFilterActive(state: FilterState): boolean {
  return (
    state.query.trim().length > 0 ||
    state.types.length > 0 ||
    state.statuses.length > 0 ||
    state.predicate !== undefined ||
    selectedGroupCount(state) > 0
  )
}

/** Total number of values selected across all filter groups. */
export function selectedGroupCount(state: FilterState): number {
  if (!state.groups) return 0
  let total = 0
  for (const values of Object.values(state.groups)) total += values.length
  return total
}

/** Values an entity carries in a group; falls back to its `type`. */
export function groupValuesOf(group: FilterGroupDef, entity: AssetEntity): readonly string[] {
  return group.valuesOf ? group.valuesOf(entity) : [entity.type]
}

/**
 * Values inside one group combine with OR (picking "critical" and "high" shows
 * both), while groups combine with AND, like the rest of the facets.
 */
function matchesGroups(
  entity: AssetEntity,
  state: FilterState,
  groups: readonly FilterGroupDef[] | undefined,
): boolean {
  if (!state.groups || !groups) return true

  for (const group of groups) {
    const selected = state.groups[group.id]
    if (!selected || selected.length === 0) continue

    const values = groupValuesOf(group, entity)
    if (!selected.some((value) => values.includes(value))) return false
  }

  return true
}

/** Default searchable fields: the label plus every sublabel. */
export function defaultSearchFields(entity: AssetEntity): string[] {
  return entity.sublabels ? [entity.label, ...entity.sublabels] : [entity.label]
}

/**
 * Matches a query against a set of fields. The query's own shape picks the mode:
 *  - CIDR (`10.38.24.0/24`) — addresses in the fields tested against the range;
 *  - wildcard (`10.38.24.*`) — addresses tested against the pattern;
 *  - anything else — case-insensitive substring.
 *
 * An empty query matches everything.
 */
export function matchesQuery(fields: readonly string[], query: string): boolean {
  const trimmed = query.trim()
  if (trimmed.length === 0) return true

  const cidr = parseCidr(trimmed)
  if (cidr) return fields.some((field) => matchesCidr(field, cidr))

  if (isIPv4Wildcard(trimmed)) return fields.some((field) => matchesWildcard(field, trimmed))

  const needle = trimmed.toLowerCase()
  return fields.some((field) => field.toLowerCase().includes(needle))
}

/**
 * What one entity offers to search, prepared once.
 *
 * Every keystroke used to lower-case every field and, for an address query,
 * pull the addresses out of every field again with a regexp — 262 ms per
 * keystroke on 100k entities. The fields of an entity do not change between
 * keystrokes, so they are read once and kept alongside it.
 */
interface SearchEntry {
  /**
   * Every field, lower-cased and joined: one `includes` instead of one per
   * field. Made on the first text query — someone searching by subnet only
   * never needs it.
   */
  haystack?: string
  /** Addresses found in the fields, as text and as numbers; read on first address query. */
  addresses?: { text: string[]; numbers: number[] }
  fields: readonly string[]
}

/**
 * Prepared entries, by the `searchFields` function that produced them and then
 * by entity.
 *
 * Weak on both levels: a new data array releases the old entities, and a new
 * `searchFields` describes different fields, so its entries cannot be reused.
 * Entities are read-only by contract — a changed entity is a new object and
 * misses the cache by itself.
 */
const searchCache = new WeakMap<object, WeakMap<AssetEntity, SearchEntry>>()

const IPV4_TEXT_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g

function searchEntryOf(entity: AssetEntity, searchFields: (entity: AssetEntity) => string[]): SearchEntry {
  let byEntity = searchCache.get(searchFields)
  if (!byEntity) {
    byEntity = new WeakMap()
    searchCache.set(searchFields, byEntity)
  }

  const cached = byEntity.get(entity)
  if (cached) return cached

  const entry: SearchEntry = { fields: searchFields(entity) }
  byEntity.set(entity, entry)
  return entry
}

function haystackOf(entry: SearchEntry): string {
  // U+0000 between fields: a needle cannot contain it, so a match never
  // straddles two fields the way it could with a printable separator.
  entry.haystack ??= entry.fields.join('\u0000').toLowerCase()
  return entry.haystack
}

function addressesOf(entry: SearchEntry): { text: string[]; numbers: number[] } {
  if (entry.addresses) return entry.addresses

  const text: string[] = []
  const numbers: number[] = []
  for (const field of entry.fields) {
    for (const match of field.matchAll(IPV4_TEXT_RE)) {
      const parsed = parseIPv4(match[0])
      if (parsed === null) continue
      text.push(match[0])
      numbers.push(parsed)
    }
  }
  entry.addresses = { text, numbers }
  return entry.addresses
}

/**
 * A query turned into a test over a prepared entry: the CIDR range parsed, the
 * wildcard compiled to a regexp, the needle lower-cased — each once per query
 * rather than once per field of every entity. Same three modes as
 * {@link matchesQuery}, and the same answers.
 */
function compileQuery(query: string): ((entry: SearchEntry) => boolean) | undefined {
  const trimmed = query.trim()
  if (trimmed.length === 0) return undefined

  const cidr = parseCidr(trimmed)
  if (cidr) return (entry) => addressesOf(entry).numbers.some((address) => cidrContains(cidr, address))

  if (isIPv4Wildcard(trimmed)) {
    const pattern = wildcardToRegExp(trimmed)
    return (entry) => addressesOf(entry).text.some((address) => pattern.test(address))
  }

  const needle = trimmed.toLowerCase()
  return (entry) => haystackOf(entry).includes(needle)
}

/**
 * Computes the direct hits and the resulting visible set.
 *
 * Criteria combine with AND: an entity matches when it passes the text query,
 * the type facet, the status facet, the groups and the custom predicate. While
 * no criterion is active there is nothing to highlight — `matchedIds` is empty
 * and the whole graph is visible.
 *
 * Visible set = hits + neighbours within `neighborDepth` steps + ancestor chains
 * (unless `keepPathToRoot` is off), so the tree does not fall apart into islands.
 */
export function applyFilters<E, L>(
  graph: AssetGraph<E, L>,
  state: FilterState,
  options: FilterOptions = {},
): FilterResult {
  const {
    neighborDepth = DEFAULT_NEIGHBOR_DEPTH,
    keepPathToRoot = true,
    searchFields = defaultSearchFields,
    restrictTo,
    layers,
  } = options

  const inScope = (id: EntityId): boolean => restrictTo === undefined || restrictTo.has(id)

  const matchedIds = new Set<EntityId>()
  const visibleIds = new Set<EntityId>()

  if (!isFilterActive(state)) {
    for (const id of graph.entities.keys()) {
      if (inScope(id)) visibleIds.add(id)
    }
    return { matchedIds, visibleIds }
  }

  const query = compileQuery(state.query)

  for (const entity of graph.entities.values()) {
    if (!inScope(entity.id)) continue
    if (state.types.length > 0 && !state.types.includes(entity.type)) continue
    if (state.statuses.length > 0 && !state.statuses.includes(entity.status ?? '')) continue
    if (state.predicate && !state.predicate(entity)) continue
    if (!matchesGroups(entity, state, options.groups)) continue
    if (query && !query(searchEntryOf(entity, searchFields))) continue
    matchedIds.add(entity.id)
  }

  for (const id of matchedIds) visibleIds.add(id)
  expandByNeighbors(graph, visibleIds, matchedIds, neighborDepth, inScope, layers)

  if (keepPathToRoot) {
    // Snapshot: ancestors must not be appended to the set being iterated.
    for (const id of [...visibleIds]) {
      for (const ancestor of ancestorsOf(graph, id)) {
        if (inScope(ancestor)) visibleIds.add(ancestor)
      }
    }
  }

  return { matchedIds, visibleIds }
}

function expandByNeighbors<E, L>(
  graph: AssetGraph<E, L>,
  visibleIds: Set<EntityId>,
  seeds: ReadonlySet<EntityId>,
  depth: number,
  inScope: (id: EntityId) => boolean,
  layers: readonly string[] | undefined,
): void {
  if (depth <= 0) return

  let frontier = [...seeds]
  const reached = new Set<EntityId>(seeds)

  for (let step = 0; step < depth && frontier.length > 0; step += 1) {
    const next: EntityId[] = []
    for (const current of frontier) {
      for (const linkId of graph.adjacency.get(current) ?? []) {
        const link = graph.links.get(linkId)
        if (!link) continue
        if (layers && !matchesLayers(link, layers)) continue
        const neighbor = otherEnd(link, current)
        // An out-of-scope node is not just hidden, it also cannot bridge to the
        // next step.
        if (reached.has(neighbor) || !inScope(neighbor)) continue
        reached.add(neighbor)
        visibleIds.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }
}

/**
 * Counts how many entities fall under each facet value.
 *
 * Values declared explicitly on a group are reported even at zero, so the
 * filter list does not jump around as the selection changes.
 */
export function facetCounts<E, L>(
  graph: AssetGraph<E, L>,
  restrictTo?: ReadonlySet<EntityId>,
  groups?: readonly FilterGroupDef[],
): FacetCounts {
  const types = new Map<string, number>()
  const statuses = new Map<string, number>()
  const groupCounts = new Map<string, Map<string, number>>()

  for (const group of groups ?? []) {
    const counts = new Map<string, number>()
    for (const option of group.options ?? []) counts.set(option.value, 0)
    groupCounts.set(group.id, counts)
  }

  for (const entity of graph.entities.values()) {
    if (restrictTo && !restrictTo.has(entity.id)) continue

    types.set(entity.type, (types.get(entity.type) ?? 0) + 1)
    if (entity.status !== undefined) {
      statuses.set(entity.status, (statuses.get(entity.status) ?? 0) + 1)
    }

    for (const group of groups ?? []) {
      const counts = groupCounts.get(group.id)
      if (!counts) continue
      for (const value of groupValuesOf(group, entity)) {
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
  }

  return { types, statuses, groups: groupCounts }
}
