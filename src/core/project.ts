import type { EntityId } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { NetworkLink } from '../types/link'
import type { NetworkView, ProjectionResult } from '../types/view'

/** Дефолтный отбор рёбер вида: слой связи совпадает с id вида. */
export function defaultLinkFilter(view: NetworkView): (link: NetworkLink) => boolean {
  return (link) => link.layers.includes(view.id)
}

/**
 * Применяет вид к графу: какие сущности и связи остаются на карте.
 *
 * Порядок шагов зафиксирован:
 *  1. `entityFilter` отбирает сущности-кандидаты;
 *  2. `linkFilter` (по умолчанию — по слою) отбирает связи, у которых оба конца
 *     остались в кандидатах;
 *  3. `hideIsolated` убирает сущности, у которых не осталось ни одной связи.
 *
 * Шаг 3 буквален: нет инцидентной видимой связи — узла нет. Предки не «спасают»
 * потомков и наоборот. Иерархия в проекции вообще не участвует: она нужна
 * свёртке, а связность карты в поиске держит `keepPathToRoot` из фильтра.
 *
 * Без вида (`view === undefined`) видно всё.
 */
export function projectGraph<E, L>(graph: NetworkGraph<E, L>, view?: NetworkView): ProjectionResult {
  const entityIds = new Set<EntityId>()
  for (const entity of graph.entities.values()) {
    if (view?.entityFilter && !view.entityFilter(entity)) continue
    entityIds.add(entity.id)
  }

  const linkFilter = view ? (view.linkFilter ?? defaultLinkFilter(view)) : undefined
  const linkIds = new Set<string>()
  const connected = new Set<EntityId>()
  for (const link of graph.links.values()) {
    if (!entityIds.has(link.source) || !entityIds.has(link.target)) continue
    if (linkFilter && !linkFilter(link)) continue
    linkIds.add(link.id)
    connected.add(link.source)
    connected.add(link.target)
  }

  if (!view?.hideIsolated) return { entityIds, linkIds }

  const kept = new Set<EntityId>()
  for (const id of entityIds) {
    if (connected.has(id)) kept.add(id)
  }
  return { entityIds: kept, linkIds }
}

/**
 * Вид по id. Неизвестный id и отсутствующий id сводятся к первому виду в списке:
 * карта всегда должна что-то показывать, даже если снаружи пришёл мусор.
 */
export function resolveView(
  views: readonly NetworkView[] | undefined,
  viewId: string | undefined,
): NetworkView | undefined {
  if (!views || views.length === 0) return undefined
  if (viewId === undefined) return views[0]
  return views.find((view) => view.id === viewId) ?? views[0]
}
