import type { EntityId, NetworkEntity } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { FacetCounts, FilterOptions, FilterResult, FilterState } from '../types/filter'
import { ancestorsOf, matchesLayers, otherEnd } from './graph'
import { isIPv4Wildcard, matchesCidr, matchesWildcard, parseCidr } from './ip'

const DEFAULT_NEIGHBOR_DEPTH = 1

export function emptyFilterState(): FilterState {
  return { query: '', kinds: [], statuses: [] }
}

/** Есть ли в состоянии хоть один активный критерий. */
export function isFilterActive(state: FilterState): boolean {
  return (
    state.query.trim().length > 0 ||
    state.kinds.length > 0 ||
    state.statuses.length > 0 ||
    state.predicate !== undefined
  )
}

/** Дефолтный набор полей для текстового поиска: имя плюс подписи. */
export function defaultSearchFields(entity: NetworkEntity): string[] {
  return entity.sublabels ? [entity.label, ...entity.sublabels] : [entity.label]
}

/**
 * Совпадение запроса с набором полей.
 *
 * Три режима, выбираются по форме запроса:
 *  - CIDR (`10.38.24.0/24`) — сравнение адресов из полей с диапазоном;
 *  - маска (`10.38.24.*`) — сравнение адресов из полей с шаблоном;
 *  - иначе — регистронезависимая подстрока.
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
 * Считает прямые совпадения и итоговый видимый набор.
 *
 * Критерии соединяются по И: узел совпал, если прошёл текстовый запрос, фасет
 * типов, фасет статусов и пользовательский предикат. Пока не активен ни один
 * критерий, подсвечивать нечего — `matchedIds` пуст, а видно весь граф.
 *
 * Видимый набор = совпадения + соседи на `neighborDepth` шагов + (по умолчанию)
 * цепочки предков, чтобы дерево не рассыпалось на изоляты.
 */
export function applyFilters<E, L>(
  graph: NetworkGraph<E, L>,
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
    if (!matchesQuery(searchFields(entity), state.query)) continue
    matchedIds.add(entity.id)
  }

  for (const id of matchedIds) visibleIds.add(id)
  expandByNeighbors(graph, visibleIds, matchedIds, neighborDepth, inScope, layers)

  if (keepPathToRoot) {
    // Снимок: дописывать предков в тот же набор, по которому идёт обход, нельзя.
    for (const id of [...visibleIds]) {
      for (const ancestor of ancestorsOf(graph, id)) {
        if (inScope(ancestor)) visibleIds.add(ancestor)
      }
    }
  }

  return { matchedIds, visibleIds }
}

function expandByNeighbors<E, L>(
  graph: NetworkGraph<E, L>,
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
        // Узел вне области видимости не только не показывается, но и не служит
        // мостиком на следующий шаг.
        if (reached.has(neighbor) || !inScope(neighbor)) continue
        reached.add(neighbor)
        visibleIds.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }
}

/** Сколько сущностей приходится на каждый тип и каждый статус. */
export function facetCounts<E, L>(
  graph: NetworkGraph<E, L>,
  restrictTo?: ReadonlySet<EntityId>,
): FacetCounts {
  const kinds = new Map<string, number>()
  const statuses = new Map<string, number>()

  for (const entity of graph.entities.values()) {
    if (restrictTo && !restrictTo.has(entity.id)) continue
    kinds.set(entity.kind, (kinds.get(entity.kind) ?? 0) + 1)
    if (entity.status !== undefined) {
      statuses.set(entity.status, (statuses.get(entity.status) ?? 0) + 1)
    }
  }

  return { kinds, statuses }
}
