/**
 * The library core: plain TypeScript, free of Vue and VueFlow.
 *
 * This subpath (`vue-asset-map/core`) is usable without the renderer — to compute
 * a projection or a blast radius on the server, for instance.
 *
 * @packageDocumentation
 */

export { buildGraph, emptyGraph } from './graph'
export type { BuildGraphOptions } from './graph'
export { ancestorsOf, descendantsOf, incidentLinks, matchesLayers, otherEnd, parentIdOf } from './graph'

export { defaultLinkFilter, projectGraph, resolveView } from './project'

export {
  applyFilters,
  defaultSearchFields,
  emptyFilterState,
  facetCounts,
  isFilterActive,
  matchesQuery,
} from './filter'

export { collapseGraph, groupIdFor, isAggregatedLink } from './collapse'
export type { CollapseOptions } from './collapse'

export { blastRadius, findPaths, neighbors } from './traverse'

export { connectionMarkers, topAnchors } from './markers'
export type { BlastRadiusOptions, FindPathsOptions } from './traverse'

export {
  cidrContains,
  extractIPv4,
  isIPv4Wildcard,
  matchesCidr,
  matchesWildcard,
  parseCidr,
  parseIPv4,
  wildcardToRegExp,
} from './ip'
export type { CidrRange } from './ip'

// Types come from their own modules rather than the `types/index` barrel: the
// barrel pulls in `types/theme`, which references Vue's `Component`. Even in a
// type-only import that would make "core without Vue" a matter of trust.
export type { Badge, EntityId, AssetEntity, XY } from '../types/entity'
export type { AssetLink } from '../types/link'
export type { AssetView, ProjectionResult } from '../types/view'
export type { GraphIssue, GraphIssueCode, AssetGraph } from '../types/graph'
export type {
  AggregatedLink,
  CollapsedGroup,
  CollapsedLink,
  CollapseResult,
  CollapseRule,
} from '../types/collapse'
export type { FacetCounts, FilterOptions, FilterResult, FilterState } from '../types/filter'
export type {
  ConnectionMarkerOptions,
  MarkerAnchor,
  NodeMarkerDef,
  ResolvedNodeMarker,
} from '../types/marker'
