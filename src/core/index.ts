/**
 * Ядро библиотеки: чистый TypeScript без Vue и без VueFlow.
 *
 * Этот подпуть (`network-map/core`) можно использовать отдельно от рендера —
 * например, чтобы посчитать проекцию или blast radius на сервере.
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

// Типы реэкспортируются из конкретных модулей, а не из барреля `types/index`:
// баррель тянет `types/theme`, а тот — тип `Component` из Vue. Ссылка на Vue
// даже в стираемом импорте сделала бы «ядро без Vue» вопросом веры, а не факта.
export type { Badge, EntityId, NetworkEntity, XY } from '../types/entity'
export type { NetworkLink } from '../types/link'
export type { NetworkView, ProjectionResult } from '../types/view'
export type { GraphIssue, GraphIssueCode, NetworkGraph } from '../types/graph'
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
