import { describe, expect, it, vi } from 'vitest'
import {
  ancestorsOf,
  buildGraph,
  descendantsOf,
  emptyGraph,
  incidentLinks,
  matchesLayers,
  otherEnd,
  parentIdOf,
} from '../../src/core/index'
import type { GraphIssue } from '../../src/types/graph'
import type { NetworkEntity } from '../../src/types/entity'
import type { NetworkLink } from '../../src/types/link'
import { entities, links } from '../../fixtures/infra'

const e = (id: string, extra: Partial<NetworkEntity> = {}): NetworkEntity => ({
  id,
  kind: 'host',
  label: id,
  ...extra,
})

const l = (id: string, source: string, target: string, extra: Partial<NetworkLink> = {}): NetworkLink => ({
  id,
  source,
  target,
  layers: ['physical'],
  ...extra,
})

describe('buildGraph: индексы', () => {
  it('индексирует сущности и связи, не мутируя вход', () => {
    const inputEntities = [e('a'), e('b')]
    const inputLinks = [l('ab', 'a', 'b')]
    const frozen = JSON.stringify({ inputEntities, inputLinks })

    const graph = buildGraph(inputEntities, inputLinks)

    expect(graph.entities.size).toBe(2)
    expect(graph.links.size).toBe(1)
    // Ссылки на объекты те же — копирования нет.
    expect(graph.entities.get('a')).toBe(inputEntities[0])
    expect(JSON.stringify({ inputEntities, inputLinks })).toBe(frozen)
  })

  it('учитывает кратность связей: параллельные рёбра дают отдельные записи', () => {
    const graph = buildGraph(
      [e('a'), e('b')],
      [l('ab-1', 'a', 'b'), l('ab-2', 'a', 'b'), l('ab-3', 'b', 'a')],
    )

    expect(graph.adjacency.get('a')).toEqual(['ab-1', 'ab-2', 'ab-3'])
    expect(graph.adjacency.get('b')).toEqual(['ab-1', 'ab-2', 'ab-3'])
    expect(graph.outgoing.get('a')).toEqual(['ab-1', 'ab-2'])
    expect(graph.incoming.get('a')).toEqual(['ab-3'])
  })

  it('петля попадает в adjacency ровно один раз', () => {
    const graph = buildGraph([e('a'), e('b')], [l('loop', 'a', 'a'), l('ab', 'a', 'b')])

    expect(graph.adjacency.get('a')).toEqual(['loop', 'ab'])
    // Но в направленных индексах петля есть с обеих сторон.
    expect(graph.outgoing.get('a')).toEqual(['loop', 'ab'])
    expect(graph.incoming.get('a')).toEqual(['loop'])
  })

  it('петля и кратность вместе: 2 петли и 2 параллельных ребра различимы', () => {
    const graph = buildGraph(
      [e('a'), e('b')],
      [l('loop-1', 'a', 'a'), l('loop-2', 'a', 'a'), l('ab-1', 'a', 'b'), l('ab-2', 'a', 'b')],
    )

    expect(graph.adjacency.get('a')).toEqual(['loop-1', 'loop-2', 'ab-1', 'ab-2'])
    expect(graph.adjacency.get('b')).toEqual(['ab-1', 'ab-2'])
  })

  it('сохраняет порядок входных данных в индексах', () => {
    const graph = buildGraph([e('z'), e('a'), e('m')], [])
    expect([...graph.entities.keys()]).toEqual(['z', 'a', 'm'])
  })

  it('пустой граф корректен', () => {
    const graph = emptyGraph()
    expect(graph.entities.size).toBe(0)
    expect(graph.roots).toEqual([])
    expect(graph.adjacency.size).toBe(0)
  })
})

describe('buildGraph: битые входные данные', () => {
  it('отбрасывает связь в несуществующую сущность', () => {
    const issues: GraphIssue[] = []
    const graph = buildGraph([e('a')], [l('dangling', 'a', 'ghost'), l('ok', 'a', 'a')], {
      onIssue: (issue) => issues.push(issue),
    })

    expect([...graph.links.keys()]).toEqual(['ok'])
    expect(issues).toEqual([{ code: 'dangling-link', id: 'dangling', detail: 'unknown entity ghost' }])
  })

  it('дубли id: побеждает первая запись', () => {
    const onIssue = vi.fn()
    const graph = buildGraph(
      [e('a', { label: 'первая' }), e('a', { label: 'вторая' })],
      [l('x', 'a', 'a'), l('x', 'a', 'a')],
      { onIssue },
    )

    expect(graph.entities.get('a')?.label).toBe('первая')
    expect(graph.links.size).toBe(1)
    expect(onIssue).toHaveBeenCalledTimes(2)
    expect(onIssue.mock.calls.map((call) => (call[0] as GraphIssue).code)).toEqual([
      'duplicate-entity',
      'duplicate-link',
    ])
  })

  it('ссылка на несуществующего родителя делает узел корневым', () => {
    const onIssue = vi.fn()
    const graph = buildGraph([e('a', { parentId: 'ghost' })], [], { onIssue })

    expect(graph.roots).toEqual(['a'])
    expect(parentIdOf(graph, 'a')).toBeNull()
    expect(onIssue).toHaveBeenCalledWith({
      code: 'missing-parent',
      id: 'a',
      detail: 'unknown parent ghost',
    })
  })

  it('узел, объявленный своим же родителем, становится корневым', () => {
    const onIssue = vi.fn()
    const graph = buildGraph([e('a', { parentId: 'a' })], [], { onIssue })

    expect(graph.roots).toEqual(['a'])
    expect(onIssue).toHaveBeenCalledWith({ code: 'self-parent', id: 'a' })
  })

  it('цикл в иерархии разрывается, обход предков завершается', () => {
    const onIssue = vi.fn()
    const graph = buildGraph(
      [e('a', { parentId: 'c' }), e('b', { parentId: 'a' }), e('c', { parentId: 'b' })],
      [],
      { onIssue },
    )

    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ code: 'parent-cycle' }))
    expect(graph.roots.length).toBe(1)
    // Главное: обходы не зависают и покрывают все три узла.
    const root = graph.roots[0] as string
    expect(new Set([root, ...descendantsOf(graph, root)])).toEqual(new Set(['a', 'b', 'c']))
    for (const id of ['a', 'b', 'c']) {
      expect(ancestorsOf(graph, id).length).toBeLessThan(3)
    }
  })
})

describe('buildGraph: иерархия', () => {
  it('строит childrenOf и roots в порядке входных данных', () => {
    const graph = buildGraph(
      [e('root'), e('c2', { parentId: 'root' }), e('c1', { parentId: 'root' }), e('other')],
      [],
    )

    expect(graph.roots).toEqual(['root', 'other'])
    expect(graph.childrenOf.get('root')).toEqual(['c2', 'c1'])
    expect(graph.childrenOf.get('other')).toBeUndefined()
  })

  it('ancestorsOf идёт от родителя к корню', () => {
    const graph = buildGraph(
      [e('a'), e('b', { parentId: 'a' }), e('c', { parentId: 'b' }), e('d', { parentId: 'c' })],
      [],
    )

    expect(ancestorsOf(graph, 'd')).toEqual(['c', 'b', 'a'])
    expect(ancestorsOf(graph, 'a')).toEqual([])
  })

  it('descendantsOf обходит поддерево в глубину', () => {
    const graph = buildGraph(
      [
        e('a'),
        e('b', { parentId: 'a' }),
        e('b1', { parentId: 'b' }),
        e('c', { parentId: 'a' }),
        e('c1', { parentId: 'c' }),
      ],
      [],
    )

    expect(descendantsOf(graph, 'a')).toEqual(['b', 'b1', 'c', 'c1'])
    expect(descendantsOf(graph, 'b1')).toEqual([])
  })
})

describe('вспомогательные функции', () => {
  it('incidentLinks фильтрует по слоям', () => {
    const graph = buildGraph(
      [e('a'), e('b')],
      [l('p', 'a', 'b', { layers: ['physical'] }), l('o', 'a', 'b', { layers: ['logical'] })],
    )

    expect(incidentLinks(graph, 'a').map((link) => link.id)).toEqual(['p', 'o'])
    expect(incidentLinks(graph, 'a', ['logical']).map((link) => link.id)).toEqual(['o'])
    // Пустой список слоёв означает «без ограничения».
    expect(incidentLinks(graph, 'a', []).map((link) => link.id)).toEqual(['p', 'o'])
    expect(incidentLinks(graph, 'ghost')).toEqual([])
  })

  it('matchesLayers и otherEnd', () => {
    const link = l('x', 'a', 'b', { layers: ['physical', 'logical'] })
    expect(matchesLayers(link, ['logical'])).toBe(true)
    expect(matchesLayers(link, ['mgmt'])).toBe(false)
    expect(otherEnd(link, 'a')).toBe('b')
    expect(otherEnd(link, 'b')).toBe('a')
    expect(otherEnd(l('loop', 'a', 'a'), 'a')).toBe('a')
  })
})

describe('фикстура демо-инфраструктуры', () => {
  it('строится без единой проблемы во входных данных', () => {
    const issues: GraphIssue[] = []
    const graph = buildGraph(entities, links, { onIssue: (issue) => issues.push(issue) })

    expect(issues).toEqual([])
    expect(graph.entities.size).toBe(entities.length)
    expect(graph.links.size).toBe(links.length)
  })

  it('14 контейнеров висят на Proxmox Beelink', () => {
    const graph = buildGraph(entities, links)
    expect(graph.childrenOf.get('pve-beelink')?.length).toBe(14)
  })
})
