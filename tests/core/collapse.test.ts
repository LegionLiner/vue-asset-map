import { describe, expect, it, vi } from 'vitest'
import { buildGraph, collapseGraph, groupIdFor, isAggregatedLink, projectGraph } from '../../src/core/index'
import type { AggregatedLink } from '../../src/types/collapse'
import type { AssetEntity } from '../../src/types/entity'
import type { AssetLink } from '../../src/types/link'
import { entities, links, views } from '../../fixtures/infra'

const e = (id: string, extra: Partial<AssetEntity> = {}): AssetEntity => ({
  id,
  type: 'host',
  label: id,
  ...extra,
})

const l = (id: string, source: string, target: string, extra: Partial<AssetLink> = {}): AssetLink => ({
  id,
  source,
  target,
  layers: ['physical'],
  ...extra,
})

/** Родитель + `count` однотипных детей, все подключённые к родителю. */
function farm(count: number, type = 'container') {
  const farmEntities: AssetEntity[] = [e('parent', { type: 'hypervisor' }), e('peer', { type: 'router' })]
  const farmLinks: AssetLink[] = [l('parent-peer', 'parent', 'peer')]

  for (let index = 1; index <= count; index += 1) {
    farmEntities.push(e(`c${index}`, { type, parentId: 'parent' }))
    farmLinks.push(l(`parent-c${index}`, 'parent', `c${index}`))
  }

  return { entities: farmEntities, links: farmLinks }
}

const GROUP_ID = groupIdFor('parent', 'container')

describe('collapseGraph: базовое решение о свёртке', () => {
  it('14 детей сворачиваются в один групповой узел', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)

    const result = collapseGraph(graph)

    expect(result.groups.length).toBe(1)
    const group = result.groups[0]
    expect(group?.id).toBe(GROUP_ID)
    expect(group?.parentId).toBe('parent')
    expect(group?.bucket).toBe('container')
    expect(group?.memberIds.length).toBe(14)
    expect(result.hiddenIds.size).toBe(14)

    // На карте: parent, peer и один групповой узел вместо 14 детей.
    expect(result.nodeIds).toEqual(['parent', 'peer', GROUP_ID])
  })

  it('10 детей при пороге 10 не сворачиваются: условие строго «больше»', () => {
    const graph = buildGraph(farm(10).entities, farm(10).links)
    expect(collapseGraph(graph).groups).toEqual([])
    expect(collapseGraph(graph, { rule: { threshold: 9 } }).groups.length).toBe(1)
  })

  it('collapse: false полностью выключает свёртку', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)

    const result = collapseGraph(graph, { rule: false })

    expect(result.groups).toEqual([])
    expect(result.hiddenIds.size).toBe(0)
    expect(result.nodeIds.length).toBe(16)
    expect(result.links.length).toBe(15)
  })

  it('groupBy задаёт своё ведро; null означает «не группировать»', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)

    const byStatus = collapseGraph(graph, {
      rule: { groupBy: () => null },
    })
    expect(byStatus.groups).toEqual([])

    const custom = collapseGraph(graph, {
      rule: { groupBy: (entity) => (entity.type === 'container' ? 'lxc' : null) },
    })
    expect(custom.groups[0]?.id).toBe(groupIdFor('parent', 'lxc'))
  })

  it('shouldCollapse полностью переопределяет порог', () => {
    const graph = buildGraph(farm(3).entities, farm(3).links)
    const shouldCollapse = vi.fn(() => true)

    const result = collapseGraph(graph, { rule: { shouldCollapse } })

    expect(result.groups.length).toBe(1)
    expect(shouldCollapse).toHaveBeenCalledWith(
      'parent',
      expect.arrayContaining([expect.objectContaining({ id: 'c1' })]),
    )
  })
})

describe('collapseGraph: рёбра', () => {
  it('рёбра участников переносятся на группу и схлопываются с верным count', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)

    const result = collapseGraph(graph)
    const aggregated = result.links.filter(isAggregatedLink)

    expect(aggregated.length).toBe(1)
    const link = aggregated[0] as AggregatedLink
    expect(link.count).toBe(14)
    expect(link.source).toBe('parent')
    expect(link.target).toBe(GROUP_ID)
    expect(link.sourceLinkIds.length).toBe(14)
    expect(link.sourceLinkIds[0]).toBe('parent-c1')

    // Плюс исходное ребро parent–peer, которое свёртка не касалась.
    expect(result.links.length).toBe(2)
    expect(result.links.some((candidate) => candidate.id === 'parent-peer')).toBe(true)
  })

  it('рёбра внутри группы отбрасываются, но считаются в internalLinkCount', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    farmLinks.push(l('c1-c2', 'c1', 'c2'), l('c2-c3', 'c2', 'c3'), l('c3-c1', 'c3', 'c1'))
    const graph = buildGraph(farmEntities, farmLinks)

    const result = collapseGraph(graph)

    expect(result.groups[0]?.internalLinkCount).toBe(3)
    expect(result.links.some((link) => link.source === link.target)).toBe(false)
  })

  it('одиночное перенесённое ребро сохраняет свой id и не становится агрегатом', () => {
    const graph = buildGraph(
      [...farm(14).entities, e('mgmt', { type: 'router' })],
      [...farm(14).links, l('mgmt-c1', 'mgmt', 'c1')],
    )

    const result = collapseGraph(graph)
    const moved = result.links.find((link) => link.id === 'mgmt-c1')

    expect(moved).toBeDefined()
    expect(moved?.target).toBe(GROUP_ID)
    expect(moved && isAggregatedLink(moved)).toBe(false)
  })

  it('настоящая кратность между обычными узлами не схлопывается', () => {
    const graph = buildGraph([e('a'), e('b')], [l('ab-1', 'a', 'b'), l('ab-2', 'a', 'b')])

    const result = collapseGraph(graph)

    expect(result.links.length).toBe(2)
    expect(result.links.every((link) => !isAggregatedLink(link))).toBe(true)
  })

  it('петля на обычном узле остаётся ребром', () => {
    const graph = buildGraph([e('a')], [l('loop', 'a', 'a')])
    const result = collapseGraph(graph)

    expect(result.links.length).toBe(1)
    expect(result.links[0]?.id).toBe('loop')
  })

  it('type и направленность не смешиваются в одном агрегате', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(
      farmEntities,
      farmLinks.map((link, index) =>
        index === 0 ? link : { ...link, type: index % 2 === 0 ? 'solid' : 'dashed' },
      ),
    )

    const aggregated = collapseGraph(graph).links.filter(isAggregatedLink)

    expect(aggregated.length).toBe(2)
    expect(aggregated.map((link) => link.type).sort()).toEqual(['dashed', 'solid'])
    expect(aggregated.reduce((sum, link) => sum + link.count, 0)).toBe(14)
  })

  it('слои агрегата — отсортированное объединение слоёв источников', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(
      farmEntities,
      farmLinks.map((link, index) =>
        index === 0 ? link : { ...link, layers: index % 2 === 0 ? ['physical'] : ['mgmt'] },
      ),
    )

    const aggregated = collapseGraph(graph).links.filter(isAggregatedLink)
    expect(aggregated[0]?.layers).toEqual(['mgmt', 'physical'])
  })
})

describe('collapseGraph: ручное раскрытие', () => {
  it('expandedIds перекрывает автоматическое правило', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)

    const result = collapseGraph(graph, { expandedIds: new Set([GROUP_ID]) })

    expect(result.groups).toEqual([])
    expect(result.hiddenIds.size).toBe(0)
    expect(result.nodeIds).toContain('c1')
    expect(result.nodeIds).not.toContain(GROUP_ID)
    expect(result.links.length).toBe(15)
  })

  it('expandedIds перекрывает даже безусловный shouldCollapse', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)

    const result = collapseGraph(graph, {
      rule: { shouldCollapse: () => true },
      expandedIds: new Set([GROUP_ID]),
    })

    expect(result.groups).toEqual([])
  })

  it('раскрытие одной группы не раскрывает другую', () => {
    const farmEntities: AssetEntity[] = [e('parent', { type: 'hypervisor' })]
    const farmLinks: AssetLink[] = []
    for (let index = 1; index <= 12; index += 1) {
      farmEntities.push(e(`c${index}`, { type: 'container', parentId: 'parent' }))
      farmEntities.push(e(`v${index}`, { type: 'vm', parentId: 'parent' }))
    }

    const graph = buildGraph(farmEntities, farmLinks)
    const result = collapseGraph(graph, { expandedIds: new Set([groupIdFor('parent', 'vm')]) })

    expect(result.groups.map((group) => group.id)).toEqual([groupIdFor('parent', 'container')])
    expect(result.nodeIds).toContain('v1')
    expect(result.nodeIds).not.toContain('c1')
  })
})

describe('collapseGraph: детерминизм и чистота', () => {
  it('одинаковый вход даёт идентичный выход', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    farmLinks.push(l('c1-c2', 'c1', 'c2'))
    const graph = buildGraph(farmEntities, farmLinks)

    const first = collapseGraph(graph)
    const second = collapseGraph(graph)

    expect(JSON.stringify(second.groups)).toBe(JSON.stringify(first.groups))
    expect(second.nodeIds).toEqual(first.nodeIds)
    expect(JSON.stringify(second.links)).toBe(JSON.stringify(first.links))
  })

  it('повторный вызов не накапливает internalLinkCount', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    farmLinks.push(l('c1-c2', 'c1', 'c2'))
    const graph = buildGraph(farmEntities, farmLinks)

    collapseGraph(graph)
    collapseGraph(graph)
    expect(collapseGraph(graph).groups[0]?.internalLinkCount).toBe(1)
  })

  it('порядок узлов привязан к входным данным: группа встаёт на место первого участника', () => {
    const graph = buildGraph(
      [
        e('first', { type: 'router' }),
        ...Array.from({ length: 11 }, (_, index) => e(`c${index}`, { type: 'container' })),
        e('last', { type: 'router' }),
      ],
      [],
    )

    const result = collapseGraph(graph)
    expect(result.nodeIds).toEqual(['first', groupIdFor(null, 'container'), 'last'])
  })

  it('id группы для корневого уровня использует пустой parentId', () => {
    expect(groupIdFor(null, 'container')).toBe('group::container')
    expect(groupIdFor('parent', 'container')).toBe('group:parent:container')
  })

  it('не мутирует входной граф', () => {
    const { entities: farmEntities, links: farmLinks } = farm(14)
    const graph = buildGraph(farmEntities, farmLinks)
    const before = JSON.stringify([...graph.entities.values(), ...graph.links.values()])

    collapseGraph(graph)

    expect(JSON.stringify([...graph.entities.values(), ...graph.links.values()])).toBe(before)
  })
})

describe('collapseGraph: взаимодействие с иерархией и видимостью', () => {
  it('поддерево участника уходит внутрь группы целиком', () => {
    const farmEntities: AssetEntity[] = [e('parent', { type: 'hypervisor' })]
    for (let index = 1; index <= 11; index += 1) {
      farmEntities.push(e(`c${index}`, { type: 'container', parentId: 'parent' }))
      farmEntities.push(e(`c${index}-child`, { type: 'process', parentId: `c${index}` }))
    }

    const graph = buildGraph(farmEntities, [])
    const result = collapseGraph(graph)

    const group = result.groups.find((candidate) => candidate.bucket === 'container')
    expect(group?.memberIds.length).toBe(11)
    // Внуки не стали отдельной группой: их поддерево уже скрыто.
    expect(result.groups.length).toBe(1)
    expect(result.hiddenIds.has('c1-child')).toBe(true)
    expect(result.groupOf.get('c1-child')).toBe(group?.id)
  })

  it('скрытый проекцией родитель не становится ключом группировки', () => {
    const farmEntities: AssetEntity[] = [
      e('root', { type: 'cloud' }),
      e('mid', { type: 'router', parentId: 'root' }),
    ]
    for (let index = 1; index <= 11; index += 1) {
      farmEntities.push(e(`c${index}`, { type: 'container', parentId: 'mid' }))
    }

    const graph = buildGraph(farmEntities, [])
    const visible = new Set(['root', ...Array.from({ length: 11 }, (_, index) => `c${index + 1}`)])
    const result = collapseGraph(graph, { visibleEntityIds: visible })

    // Группировка поднялась на уровень видимого предка.
    expect(result.groups[0]?.id).toBe(groupIdFor('root', 'container'))
  })

  it('видимость сужает и узлы, и рёбра', () => {
    const graph = buildGraph([e('a'), e('b'), e('c')], [l('ab', 'a', 'b'), l('bc', 'b', 'c')])

    const result = collapseGraph(graph, {
      rule: false,
      visibleEntityIds: new Set(['a', 'b']),
    })

    expect(result.nodeIds).toEqual(['a', 'b'])
    // Ребро b–c отброшено: конца `c` на карте нет.
    expect(result.links.map((link) => link.id)).toEqual(['ab'])
  })

  it('visibleLinkIds отфильтровывает связи, оставляя узлы', () => {
    const graph = buildGraph([e('a'), e('b')], [l('ab', 'a', 'b'), l('ab2', 'a', 'b')])

    const result = collapseGraph(graph, { visibleLinkIds: new Set(['ab']) })

    expect(result.nodeIds).toEqual(['a', 'b'])
    expect(result.links.map((link) => link.id)).toEqual(['ab'])
  })
})

describe('collapseGraph на фикстуре', () => {
  const graph = buildGraph(entities, links)

  it('ферма из 14 контейнеров — единственная свёрнутая группа', () => {
    const result = collapseGraph(graph)

    expect(result.groups.map((group) => group.id)).toEqual([groupIdFor('pve-beelink', 'container')])
    expect(result.groups[0]?.memberIds.length).toBe(14)
    expect(result.groups[0]?.internalLinkCount).toBe(2)
  })

  it('14 связей гипервизора с контейнерами схлопнулись в одну', () => {
    const result = collapseGraph(graph)
    const aggregated = result.links.filter(isAggregatedLink)

    expect(aggregated.length).toBe(1)
    expect(aggregated[0]?.count).toBe(14)
    expect(aggregated[0]?.source).toBe('pve-beelink')
    expect(aggregated[0]?.target).toBe(groupIdFor('pve-beelink', 'container'))
  })

  it('второй канал офиса B остаётся отдельным ребром рядом с основным', () => {
    const result = collapseGraph(graph)
    const keen2Internet = result.links.filter(
      (link) =>
        (link.source === 'keenetic-2' && link.target === 'internet') ||
        (link.source === 'internet' && link.target === 'keenetic-2'),
    )

    expect(keen2Internet.map((link) => link.id).sort()).toEqual(['l-inet-keen2', 'l-keen2-inet-backup'])
  })

  it('свёртка работает поверх проекции логического вида', () => {
    const projection = projectGraph(graph, views[1])
    const result = collapseGraph(graph, {
      visibleEntityIds: projection.entityIds,
      visibleLinkIds: projection.linkIds,
    })

    // Контейнеров в оверлее нет — сворачивать нечего.
    expect(result.groups).toEqual([])
    expect(result.nodeIds).not.toContain('ct-web-1')
    expect(result.nodeIds).toContain('vps-tailscale')
  })

  it('группа из одного узла не создаётся даже по требованию shouldCollapse', () => {
    const single = buildGraph([e('parent'), e('only', { parentId: 'parent' })], [])
    expect(collapseGraph(single, { rule: { shouldCollapse: () => true } }).groups).toEqual([])
  })
})
