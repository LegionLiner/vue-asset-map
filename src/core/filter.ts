import type { EntityId, AssetEntity } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { FacetCounts, FilterGroupDef, FilterOptions, FilterResult, FilterState } from '../types/filter'
import { ancestorsOf, matchesLayers, otherEnd } from './graph'
import { isIPv4Wildcard, matchesCidr, matchesWildcard, parseCidr } from './ip'

const DEFAULT_NEIGHBOR_DEPTH = 1

/** Filter state with nothing selected — the initial value for `v-model:filters`. */
export function emptyFilterState(): FilterState {
  return { query: '', kinds: [], statuses: [] }
}

/** Whether any criterion is set. While `false`, the whole graph stays visible. */
export function isFilterActive(state: FilterState): boolean {
  return (
    state.query.trim().length > 0 ||
    state.kinds.length > 0 ||
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

/** Values an entity carries in a group; falls back to its `kind`. */
export function groupValuesOf(group: FilterGroupDef, entity: AssetEntity): readonly string[] {
  return group.valuesOf ? group.valuesOf(entity) : [entity.kind]
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
 * Computes the direct hits and the resulting visible set.
 *
 * Criteria combine with AND: an entity matches when it passes the text query,
 * the kind facet, the status facet, the groups and the custom predicate. While
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

  for (const entity of graph.entities.values()) {
    if (!inScope(entity.id)) continue
    if (state.kinds.length > 0 && !state.kinds.includes(entity.kind)) continue
    if (state.statuses.length > 0 && !state.statuses.includes(entity.status ?? '')) continue
    if (state.predicate && !state.predicate(entity)) continue
    if (!matchesGroups(entity, state, options.groups)) continue
    if (!matchesQuery(searchFields(entity), state.query)) continue
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
  const kinds = new Map<string, number>()
  const statuses = new Map<string, number>()
  const groupCounts = new Map<string, Map<string, number>>()

  for (const group of groups ?? []) {
    const counts = new Map<string, number>()
    for (const option of group.options ?? []) counts.set(option.value, 0)
    groupCounts.set(group.id, counts)
  }

  for (const entity of graph.entities.values()) {
    if (restrictTo && !restrictTo.has(entity.id)) continue

    kinds.set(entity.kind, (kinds.get(entity.kind) ?? 0) + 1)
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

  return { kinds, statuses, groups: groupCounts }
}
