import type { EntityId, NetworkEntity } from '../types/entity'
import type { NetworkGraph } from '../types/graph'
import type { NetworkLink } from '../types/link'
import type {
  AggregatedLink,
  CollapsedGroup,
  CollapsedLink,
  CollapseResult,
  CollapseRule,
} from '../types/collapse'
import { descendantsOf } from './graph'

export interface CollapseOptions {
  /** `false` полностью выключает свёртку. */
  rule?: CollapseRule | false
  /** Группы, раскрытые вручную. Перекрывают автоматическое правило. */
  expandedIds?: ReadonlySet<string>
  /** Ограничение по сущностям (результат проекции и фильтра). */
  visibleEntityIds?: ReadonlySet<EntityId>
  /** Ограничение по связям (результат проекции). */
  visibleLinkIds?: ReadonlySet<string>
  /**
   * Родители, чьё поддерево скрыто кнопкой на самом узле.
   *
   * Отличается от `expandedIds`: там речь о синтетических групповых узлах, здесь —
   * о настоящей сущности, которая остаётся на карте, а её потомки прячутся
   * внутрь. Рёбра потомков переносятся на родителя по тем же правилам, что и на
   * групповой узел.
   */
  collapsedParentIds?: ReadonlySet<EntityId>
}

const DEFAULT_THRESHOLD = 10

/**
 * Разделитель составных ключей группировки рёбер.
 *
 * U+0000, а не `:` или пробел: id сущностей — произвольные строки потребителя
 * и могут содержать любой печатный символ, из-за чего склейка через печатный
 * разделитель давала бы коллизии ключей.
 */
const KEY_SEPARATOR = '\u0000'

export function isAggregatedLink<L>(link: NetworkLink<L>): link is AggregatedLink<L> {
  return (link as { aggregated?: unknown }).aggregated === true
}

/** id группы. Формат: `group:<parentId>:<bucket>`; для корня parentId пуст. */
export function groupIdFor(parentId: EntityId | null, bucket: string): string {
  return `group:${parentId ?? ''}:${bucket}`
}

const defaultGroupBy = (entity: NetworkEntity): string | null => entity.kind

/**
 * Свёртка крупных групп однотипных детей в один узел.
 *
 * Функция чистая и детерминированная: порядок групп, узлов и рёбер выводится из
 * порядка входных массивов, поэтому одинаковый вход даёт побайтово одинаковый
 * выход. Выполняется до раскладки — позиции считаются уже по схлопнутому графу.
 *
 * Решения, которые стоит знать:
 *  - Родитель для группировки — ближайший *видимый* предок. Если проекция скрыла
 *    родителя, его дети группируются на уровне выше, а не под скрытым id.
 *  - Обход идёт сверху вниз по уровням. Как только уровень схлопнут, его
 *    поддеревья не рассматриваются — вложенных групп внутри групп не возникает.
 *  - `expandedIds` проверяется раньше правила, поэтому раскрытие руками всегда
 *    сильнее `shouldCollapse` и порога.
 *  - Рёбра участников переносятся на групповой узел. Параллельные рёбра
 *    схлопываются в `AggregatedLink` только если хотя бы один конец — группа:
 *    настоящая кратность связей между обычными узлами остаётся видимой.
 *  - Ребро, у которого оба конца внутри одной группы, не рисуется, а попадает в
 *    `internalLinkCount`.
 */
export function collapseGraph<E, L>(
  graph: NetworkGraph<E, L>,
  options: CollapseOptions = {},
): CollapseResult<L> {
  const { rule, expandedIds, visibleEntityIds, visibleLinkIds, collapsedParentIds } = options

  const inProjection = (id: EntityId): boolean => visibleEntityIds === undefined || visibleEntityIds.has(id)

  // Потомки свёрнутых родителей выпадают из карты до всех остальных решений:
  // они не должны ни группироваться, ни попадать в узлы.
  const subtreeHidden = hiddenBySubtree(graph, collapsedParentIds, inProjection)

  const isEntityVisible = (id: EntityId): boolean => inProjection(id) && !subtreeHidden.has(id)

  const visibleEntities: NetworkEntity<E>[] = []
  for (const entity of graph.entities.values()) {
    if (isEntityVisible(entity.id)) visibleEntities.push(entity)
  }

  // Концы проверяются по проекции, а не по итоговой видимости: ребро скрытого
  // потомка не выбрасывается, а переносится на свёрнутого родителя.
  const visibleLinks: NetworkLink<L>[] = []
  for (const link of graph.links.values()) {
    if (visibleLinkIds !== undefined && !visibleLinkIds.has(link.id)) continue
    if (!inProjection(link.source) || !inProjection(link.target)) continue
    visibleLinks.push(link)
  }

  // Потомки свёрнутых родителей адресуются на самого родителя — так же, как
  // участники группы адресуются на групповой узел.
  const groupOf = new Map<EntityId, string>(subtreeHidden)
  const hiddenIds = new Set<EntityId>(subtreeHidden.keys())

  if (rule === false) {
    return {
      groups: [],
      groupOf,
      hiddenIds,
      nodeIds: visibleEntities.map((entity) => entity.id),
      links: remapLinks(visibleLinks, groupOf, new Set(), [], collapsedParentIds),
    }
  }

  // `undefined` — это «правило по умолчанию», выключает свёртку только `false`:
  // так же читается prop `collapse` у <NetworkMap>.
  const groups = decideGroups(graph, visibleEntities, rule ?? {}, expandedIds, isEntityVisible)
  const groupIds = new Set(groups.map((group) => group.id))
  indexMembers(graph, groups, groupOf, hiddenIds)

  const nodeIds = orderNodes(visibleEntities, groupOf, hiddenIds)
  const links = remapLinks(visibleLinks, groupOf, groupIds, groups, collapsedParentIds)

  return { groups, groupOf, hiddenIds, nodeIds, links }
}

/** Ближайший предок, оставшийся видимым. `null`, если такого нет. */
function visibleParentOf<E, L>(
  graph: NetworkGraph<E, L>,
  id: EntityId,
  isEntityVisible: (id: EntityId) => boolean,
): EntityId | null {
  let cursor = graph.parentOf.get(id) ?? null
  const seen = new Set<EntityId>([id])
  while (cursor !== null && !seen.has(cursor)) {
    if (isEntityVisible(cursor)) return cursor
    seen.add(cursor)
    cursor = graph.parentOf.get(cursor) ?? null
  }
  return null
}

/**
 * Обход уровней сверху вниз с решением по каждому «ведру» детей.
 * Возвращает группы в порядке обнаружения.
 */
function decideGroups<E, L>(
  graph: NetworkGraph<E, L>,
  visibleEntities: readonly NetworkEntity<E>[],
  rule: CollapseRule,
  expandedIds: ReadonlySet<string> | undefined,
  isEntityVisible: (id: EntityId) => boolean,
): CollapsedGroup[] {
  const threshold = rule.threshold ?? DEFAULT_THRESHOLD
  const groupBy = rule.groupBy ?? defaultGroupBy

  // Дети по эффективному видимому родителю; ключ `null` — верхний уровень.
  const childrenByParent = new Map<EntityId | null, NetworkEntity<E>[]>()
  for (const entity of visibleEntities) {
    const parentId = visibleParentOf(graph, entity.id, isEntityVisible)
    const bucket = childrenByParent.get(parentId)
    if (bucket) bucket.push(entity)
    else childrenByParent.set(parentId, [entity])
  }

  const groups: CollapsedGroup[] = []
  // Обход в ширину по уровням иерархии. Индекс вместо shift(): `null` —
  // легальный элемент очереди (верхний уровень), и его нельзя путать с концом.
  const queue: (EntityId | null)[] = [null]
  const processed = new Set<EntityId | null>()

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const parentId = queue[cursor] ?? null
    if (processed.has(parentId)) continue
    processed.add(parentId)

    const children = childrenByParent.get(parentId) ?? []
    const buckets = new Map<string, NetworkEntity<E>[]>()
    const ungrouped: NetworkEntity<E>[] = []

    for (const child of children) {
      const bucket = groupBy(child)
      // `null` из groupBy — «этот узел не группировать никогда».
      if (bucket === null) {
        ungrouped.push(child)
        continue
      }
      const members = buckets.get(bucket)
      if (members) members.push(child)
      else buckets.set(bucket, [child])
    }

    for (const [bucket, members] of buckets) {
      const groupId = groupIdFor(parentId, bucket)
      const collapsed =
        // Группа из одного узла бессмысленна: она прячет узел за узлом и ничего
        // не экономит. Это ограничение сильнее `shouldCollapse`.
        members.length >= 2 &&
        !expandedIds?.has(groupId) &&
        (rule.shouldCollapse ? rule.shouldCollapse(parentId, members) : members.length > threshold)

      if (collapsed) {
        groups.push({
          id: groupId,
          parentId,
          bucket,
          memberIds: members.map((member) => member.id),
          internalLinkCount: 0,
        })
        // Поддеревья участников целиком уходят внутрь группы — вглубь не идём.
        continue
      }
      for (const member of members) queue.push(member.id)
    }

    for (const child of ungrouped) queue.push(child.id)
  }

  return groups
}

/**
 * Потомки свёрнутых родителей: потомок → id родителя, который его прячет.
 *
 * Порядок обхода — порядок сущностей во входных данных, поэтому при вложенных
 * свёрнутых родителях побеждает тот, кто ближе к корню, и результат однозначен.
 */
function hiddenBySubtree<E, L>(
  graph: NetworkGraph<E, L>,
  collapsedParentIds: ReadonlySet<EntityId> | undefined,
  inProjection: (id: EntityId) => boolean,
): Map<EntityId, EntityId> {
  const hidden = new Map<EntityId, EntityId>()
  if (!collapsedParentIds || collapsedParentIds.size === 0) return hidden

  for (const parentId of graph.entities.keys()) {
    if (!collapsedParentIds.has(parentId)) continue
    if (!inProjection(parentId)) continue
    // Уже спрятанный родитель не прячет никого: его поддерево уже внутри
    // предка, который свёрнут выше.
    if (hidden.has(parentId)) continue

    for (const descendant of descendantsOf(graph, parentId)) {
      if (hidden.has(descendant)) continue
      hidden.set(descendant, parentId)
    }
  }

  return hidden
}

/** Дописывает в индексы участников групп и их поддеревья. */
function indexMembers<E, L>(
  graph: NetworkGraph<E, L>,
  groups: readonly CollapsedGroup[],
  groupOf: Map<EntityId, string>,
  hiddenIds: Set<EntityId>,
): void {
  for (const group of groups) {
    for (const memberId of group.memberIds) {
      if (!groupOf.has(memberId)) {
        groupOf.set(memberId, group.id)
        hiddenIds.add(memberId)
      }
      for (const descendant of descendantsOf(graph, memberId)) {
        if (groupOf.has(descendant)) continue
        groupOf.set(descendant, group.id)
        hiddenIds.add(descendant)
      }
    }
  }
}

/**
 * Порядок узлов схлопнутого графа. Групповой узел встаёт на место первого
 * своего участника — так порядок остаётся привязанным к входным данным.
 */
function orderNodes<E>(
  visibleEntities: readonly NetworkEntity<E>[],
  groupOf: ReadonlyMap<EntityId, string>,
  hiddenIds: ReadonlySet<EntityId>,
): string[] {
  const nodeIds: string[] = []
  const emitted = new Set<string>()

  for (const entity of visibleEntities) {
    if (!hiddenIds.has(entity.id)) {
      nodeIds.push(entity.id)
      continue
    }
    const groupId = groupOf.get(entity.id)
    if (groupId === undefined || emitted.has(groupId)) continue
    emitted.add(groupId)
    nodeIds.push(groupId)
  }

  return nodeIds
}

interface LinkBundle<L> {
  source: string
  target: string
  links: NetworkLink<L>[]
}

function remapLinks<L>(
  visibleLinks: readonly NetworkLink<L>[],
  groupOf: ReadonlyMap<EntityId, string>,
  groupIds: ReadonlySet<string>,
  groups: readonly CollapsedGroup[],
  collapsedParentIds: ReadonlySet<EntityId> | undefined,
): CollapsedLink<L>[] {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const bundles = new Map<string, LinkBundle<L>>()

  for (const link of visibleLinks) {
    const source = groupOf.get(link.source) ?? link.source
    const target = groupOf.get(link.target) ?? link.target
    const remapped = groupOf.has(link.source) || groupOf.has(link.target)

    if (source === target) {
      if (remapped) {
        // Оба конца оказались внутри одной группы или одного свёрнутого
        // поддерева: петлю не рисуем. Для группы её ещё и считаем.
        const group = groupById.get(source)
        if (group) group.internalLinkCount += 1
        continue
      }
      // Настоящая петля на обычном узле — остаётся ребром.
    }

    const key = bundleKey(source, target, link)
    const bundle = bundles.get(key)
    if (bundle) bundle.links.push(link)
    else bundles.set(key, { source, target, links: [link] })
  }

  const out: CollapsedLink<L>[] = []
  for (const bundle of bundles.values()) {
    const first = bundle.links[0]
    if (first === undefined) continue

    if (bundle.links.length === 1) {
      out.push(
        first.source === bundle.source && first.target === bundle.target
          ? first
          : { ...first, source: bundle.source, target: bundle.target },
      )
      continue
    }

    // Агрегируем только пучки, появившиеся из-за свёртки: и группа, и свёрнутый
    // родитель собирают на себя рёбра спрятанных узлов.
    const touchesCollapsed =
      groupIds.has(bundle.source) ||
      groupIds.has(bundle.target) ||
      collapsedParentIds?.has(bundle.source) === true ||
      collapsedParentIds?.has(bundle.target) === true

    if (!touchesCollapsed) {
      // Настоящая кратность между обычными узлами — оставляем как есть.
      out.push(...bundle.links)
      continue
    }

    out.push(aggregate(bundle, first))
  }

  return out
}

/**
 * Ключ пучка рёбер. Для неориентированных рёбер концы нормализуются, чтобы
 * `a→b` и `b→a` попали в один пучок; `kind` и направленность не смешиваются,
 * иначе агрегат потерял бы стиль отрисовки.
 */
function bundleKey<L>(source: string, target: string, link: NetworkLink<L>): string {
  const kind = link.kind ?? ''
  if (link.directed === true) return ['d', source, target, kind].join(KEY_SEPARATOR)
  const [a, b] = source <= target ? [source, target] : [target, source]
  return ['u', a, b, kind].join(KEY_SEPARATOR)
}

function aggregate<L>(bundle: LinkBundle<L>, first: NetworkLink<L>): AggregatedLink<L> {
  const layers = new Set<string>()
  const sourceLinkIds: string[] = []
  for (const link of bundle.links) {
    for (const layer of link.layers) layers.add(layer)
    sourceLinkIds.push(link.id)
  }

  const aggregated: AggregatedLink<L> = {
    id: `agg:${bundle.source}->${bundle.target}#${first.kind ?? ''}`,
    source: bundle.source,
    target: bundle.target,
    // Сортировка ради детерминизма: порядок слоёв не должен зависеть от того,
    // в каком порядке пришли исходные рёбра.
    layers: [...layers].sort(),
    aggregated: true,
    count: bundle.links.length,
    sourceLinkIds,
  }
  if (first.kind !== undefined) aggregated.kind = first.kind
  if (first.directed !== undefined) aggregated.directed = first.directed
  return aggregated
}
