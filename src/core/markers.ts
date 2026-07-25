import type { EntityId } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { ConnectionMarkerOptions, MarkerAnchor, NodeMarkerDef } from '../types/marker'
import { neighbors } from './traverse'

/**
 * Маркеры принадлежности по связям графа.
 *
 * Для каждого опорного узла получается маркер, который есть у всех, кто с ним
 * связан. Поэтому у рабочей станции оказывается сразу два кружка: один за
 * роутером, к которому она подключена физически, второй за координатором VPN, с
 * которым её соединяет оверлей. Принадлежность к одному не отменяет другой.
 *
 * По умолчанию учитываются связи всех слоёв, а не только текущего вида: смысл
 * кружков — показать полную картину принадлежности, не переключая вид.
 *
 * Состав считается через `members`, то есть один обход на опорный узел за смену
 * графа. Предикат `match` для этого не годится: он вызывается на каждую
 * сущность, и обход пришлось бы повторять сущности × маркеры раз.
 */
export function connectionMarkers(
  anchors: readonly MarkerAnchor[],
  options: ConnectionMarkerOptions = {},
): NodeMarkerDef[] {
  const { depth = 1, layers, includeAnchor = true } = options

  return anchors.map((anchor) => {
    const def: NodeMarkerDef = {
      id: anchor.id,
      members: (graph: NetworkGraph) => membersOf(graph, anchor.id, depth, layers, includeAnchor),
    }
    if (anchor.label !== undefined) def.label = anchor.label
    if (anchor.color !== undefined) def.color = anchor.color
    return def
  })
}

function membersOf(
  graph: NetworkGraph,
  anchorId: EntityId,
  depth: number,
  layers: readonly string[] | undefined,
  includeAnchor: boolean,
): Set<EntityId> {
  // `neighbors` возвращает новое множество, поэтому его можно дополнять.
  const members = neighbors(graph, anchorId, depth, layers)
  if (includeAnchor && graph.entities.has(anchorId)) members.add(anchorId)
  return members
}

/**
 * Опорные узлы по степени связности: самые «центральные» узлы графа.
 *
 * Удобно, когда хабы заранее не известны: карта активов приходит из
 * инвентаризации, и какой узел окажется центром, видно только из данных.
 * Порядок детерминирован — при равной степени раньше идёт тот, кто раньше во
 * входных данных.
 */
export function topAnchors<E, L>(
  graph: NetworkGraph<E, L>,
  count: number,
  layers?: readonly string[],
): MarkerAnchor[] {
  const scored: { id: EntityId; label: string; degree: number }[] = []

  for (const entity of graph.entities.values()) {
    const incident = graph.adjacency.get(entity.id) ?? []
    const degree =
      layers === undefined
        ? incident.length
        : incident.filter((linkId) => {
            const link = graph.links.get(linkId)
            return link ? link.layers.some((layer) => layers.includes(layer)) : false
          }).length

    if (degree > 0) scored.push({ id: entity.id, label: entity.label, degree })
  }

  // Сортировка стабильна в современных движках, поэтому при равной степени
  // порядок остаётся входным.
  scored.sort((a, b) => b.degree - a.degree)

  return scored.slice(0, Math.max(0, count)).map(({ id, label }) => ({ id, label }))
}
