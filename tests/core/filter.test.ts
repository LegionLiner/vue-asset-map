import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  buildGraph,
  defaultSearchFields,
  emptyFilterState,
  facetCounts,
  isFilterActive,
  matchesQuery,
  projectGraph,
} from '../../src/core/index'
import type { FilterState } from '../../src/types/filter'
import type { AssetEntity } from '../../src/types/entity'
import type { AssetLink } from '../../src/types/link'
import { entities, links, views } from '../../fixtures/infra'

const graph = buildGraph(entities, links)

const state = (partial: Partial<FilterState> = {}): FilterState => ({
  ...emptyFilterState(),
  ...partial,
})

const e = (id: string, extra: Partial<AssetEntity> = {}): AssetEntity => ({
  id,
  type: 'host',
  label: id,
  ...extra,
})

const l = (id: string, source: string, target: string): AssetLink => ({
  id,
  source,
  target,
  layers: ['physical'],
})

describe('isFilterActive', () => {
  it('пустое состояние неактивно', () => {
    expect(isFilterActive(emptyFilterState())).toBe(false)
    expect(isFilterActive(state({ query: '   ' }))).toBe(false)
  })

  it('любой заполненный критерий делает состояние активным', () => {
    expect(isFilterActive(state({ query: 'a' }))).toBe(true)
    expect(isFilterActive(state({ types: ['vps'] }))).toBe(true)
    expect(isFilterActive(state({ statuses: ['online'] }))).toBe(true)
    expect(isFilterActive(state({ predicate: () => true }))).toBe(true)
  })
})

describe('matchesQuery', () => {
  it('пустой запрос совпадает со всем', () => {
    expect(matchesQuery(['что угодно'], '')).toBe(true)
    expect(matchesQuery([], '  ')).toBe(true)
  })

  it('регистронезависимая подстрока', () => {
    expect(matchesQuery(['Tailscale VPS'], 'tailscale')).toBe(true)
    expect(matchesQuery(['Tailscale VPS'], 'SCALE V')).toBe(true)
    expect(matchesQuery(['Tailscale VPS'], 'proxmox')).toBe(false)
  })

  it('маска подсети', () => {
    expect(matchesQuery(['10.38.24.70'], '10.38.24.*')).toBe(true)
    expect(matchesQuery(['10.38.25.70'], '10.38.24.*')).toBe(false)
  })

  it('CIDR', () => {
    expect(matchesQuery(['10.38.24.70'], '10.38.24.0/24')).toBe(true)
    expect(matchesQuery(['10.38.25.70'], '10.38.24.0/24')).toBe(false)
  })

  it('битый CIDR откатывается к подстроке, а не молча совпадает со всем', () => {
    expect(matchesQuery(['сеть 10.38.24.0/99 (опечатка в данных)'], '10.38.24.0/99')).toBe(true)
    expect(matchesQuery(['10.38.24.70'], '10.38.24.0/99')).toBe(false)
  })
})

describe('defaultSearchFields', () => {
  it('это label плюс sublabels', () => {
    expect(defaultSearchFields(e('a', { label: 'Хост', sublabels: ['10.0.0.1'] }))).toEqual([
      'Хост',
      '10.0.0.1',
    ])
    expect(defaultSearchFields(e('a', { label: 'Хост' }))).toEqual(['Хост'])
  })
})

describe('applyFilters: неактивный фильтр', () => {
  it('подсвечивать нечего, видно всё', () => {
    const result = applyFilters(graph, emptyFilterState())

    expect(result.matchedIds.size).toBe(0)
    expect(result.visibleIds.size).toBe(entities.length)
  })

  it('неактивный фильтр уважает restrictTo', () => {
    const result = applyFilters(graph, emptyFilterState(), {
      restrictTo: new Set(['ws-dmitry', 'keenetic-2']),
    })

    expect(result.visibleIds).toEqual(new Set(['ws-dmitry', 'keenetic-2']))
  })
})

describe('applyFilters: поиск', () => {
  it('совпадение по label', () => {
    const result = applyFilters(graph, state({ query: 'dmitry' }), { neighborDepth: 0 })
    expect([...result.matchedIds]).toEqual(['ws-dmitry'])
  })

  it('совпадение по sublabel: FQDN', () => {
    const result = applyFilters(graph, state({ query: 'pteam2.netcraze' }), { neighborDepth: 0 })
    expect([...result.matchedIds]).toEqual(['keenetic-2'])
  })

  it('совпадение по маске IP', () => {
    const result = applyFilters(graph, state({ query: '10.38.24.*' }), { neighborDepth: 0 })

    expect(result.matchedIds).toEqual(
      new Set(['ws-artjom', 'ws-sergey', 'ws-dmitry', 'ws-vlad', 'ws-andrey']),
    )
  })

  it('совпадение по CIDR', () => {
    const result = applyFilters(graph, state({ query: '10.38.24.0/24' }), { neighborDepth: 0 })

    expect(result.matchedIds).toEqual(
      new Set(['ws-artjom', 'ws-sergey', 'ws-dmitry', 'ws-vlad', 'ws-andrey']),
    )
  })

  it('CIDR оверлея находит рабочие станции и координатор', () => {
    const result = applyFilters(graph, state({ query: '100.64.0.0/24' }), { neighborDepth: 0 })

    expect(result.matchedIds.has('vps-tailscale')).toBe(true)
    expect(result.matchedIds.has('ws-andrey')).toBe(true)
    expect(result.matchedIds.has('internet')).toBe(false)
  })

  it('свои searchFields заменяют дефолтные', () => {
    const result = applyFilters(graph, state({ query: 'artjom' }), {
      neighborDepth: 0,
      searchFields: (entity) => [entity.id],
    })

    // По id совпадают и рабочая станция, и гипервизор; по label — только станция.
    expect(result.matchedIds).toEqual(new Set(['pve-artjom', 'ws-artjom']))
  })
})

describe('applyFilters: фасеты', () => {
  it('фильтр по типу', () => {
    const result = applyFilters(graph, state({ types: ['router'] }), { neighborDepth: 0 })
    expect(result.matchedIds).toEqual(new Set(['keenetic-1', 'keenetic-2']))
  })

  it('фильтр по статусу', () => {
    const result = applyFilters(graph, state({ statuses: ['offline'] }), { neighborDepth: 0 })
    expect(result.matchedIds).toEqual(new Set(['ws-vlad', 'ct-web-4']))
  })

  it('критерии соединяются по И', () => {
    const result = applyFilters(
      graph,
      state({ query: 'proxmox', types: ['hypervisor'], statuses: ['degraded'] }),
      { neighborDepth: 0 },
    )
    expect([...result.matchedIds]).toEqual(['pve-gpu'])
  })

  it('predicate участвует в конъюнкции', () => {
    const result = applyFilters(
      graph,
      state({ types: ['vps'], predicate: (entity) => entity.meta !== undefined }),
      { neighborDepth: 0, searchFields: (entity) => [entity.label] },
    )
    expect(result.matchedIds.size).toBe(4)

    const none = applyFilters(graph, state({ types: ['vps'], predicate: () => false }), {
      neighborDepth: 0,
    })
    expect(none.matchedIds.size).toBe(0)
  })
})

describe('applyFilters: расширение видимости', () => {
  it('соседи на 1 шаг добавляются к совпадениям', () => {
    const result = applyFilters(graph, state({ query: 'BrainStorm' }), { keepPathToRoot: false })

    expect([...result.matchedIds]).toEqual(['vps-brainstorm'])
    // Физический сосед — Интернет, логический — Tailscale VPS.
    expect(result.visibleIds).toEqual(new Set(['vps-brainstorm', 'internet', 'vps-tailscale']))
  })

  it('глубина 2 добавляет соседей соседей', () => {
    const shallow = applyFilters(graph, state({ query: 'BrainStorm' }), {
      neighborDepth: 1,
      keepPathToRoot: false,
    })
    const deep = applyFilters(graph, state({ query: 'BrainStorm' }), {
      neighborDepth: 2,
      keepPathToRoot: false,
    })

    expect(deep.visibleIds.size).toBeGreaterThan(shallow.visibleIds.size)
    for (const id of shallow.visibleIds) expect(deep.visibleIds.has(id)).toBe(true)
  })

  it('слои ограничивают расширение до соседей', () => {
    const result = applyFilters(graph, state({ query: 'BrainStorm' }), {
      keepPathToRoot: false,
      layers: ['logical'],
    })

    expect(result.visibleIds).toEqual(new Set(['vps-brainstorm', 'vps-tailscale']))
  })

  it('keepPathToRoot не даёт графу рассыпаться на изоляты', () => {
    // Контейнер связан только со своим гипервизором, а тот — с роутером.
    const result = applyFilters(graph, state({ query: 'web-07' }), {
      neighborDepth: 0,
      keepPathToRoot: true,
    })

    expect([...result.matchedIds]).toEqual(['ct-web-7'])
    expect(result.visibleIds).toEqual(new Set(['ct-web-7', 'pve-beelink', 'keenetic-2']))
  })

  it('без keepPathToRoot совпадение остаётся изолятом', () => {
    const result = applyFilters(graph, state({ query: 'web-07' }), {
      neighborDepth: 0,
      keepPathToRoot: false,
    })

    expect(result.visibleIds).toEqual(new Set(['ct-web-7']))
  })

  it('цепочка предков достраивается целиком, а не на один уровень', () => {
    const deepGraph = buildGraph(
      [e('l0'), e('l1', { parentId: 'l0' }), e('l2', { parentId: 'l1' }), e('l3', { parentId: 'l2' })],
      [],
    )

    const result = applyFilters(deepGraph, state({ query: 'l3' }), { neighborDepth: 0 })
    expect(result.visibleIds).toEqual(new Set(['l3', 'l2', 'l1', 'l0']))
  })

  it('узел вне restrictTo не служит мостиком к следующему шагу', () => {
    const chain = buildGraph([e('a'), e('b'), e('c')], [l('ab', 'a', 'b'), l('bc', 'b', 'c')])

    const result = applyFilters(chain, state({ query: 'a' }), {
      neighborDepth: 5,
      keepPathToRoot: false,
      restrictTo: new Set(['a', 'c']),
    })

    // `b` скрыт, поэтому до `c` расширение не доходит.
    expect(result.visibleIds).toEqual(new Set(['a']))
  })

  it('работает поверх проекции вида', () => {
    const projection = projectGraph(graph, views[1])
    const result = applyFilters(graph, state({ query: 'Proxmox' }), {
      restrictTo: projection.entityIds,
      layers: ['logical'],
      keepPathToRoot: false,
    })

    expect(result.matchedIds).toEqual(new Set(['pve-artjom', 'pve-beelink', 'pve-gpu']))
    expect(result.visibleIds.has('vps-tailscale')).toBe(true)
    expect(result.visibleIds.has('keenetic-1')).toBe(false)
  })

  it('запрос без совпадений даёт пустую карту', () => {
    const result = applyFilters(graph, state({ query: 'такого-хоста-нет' }))

    expect(result.matchedIds.size).toBe(0)
    expect(result.visibleIds.size).toBe(0)
  })
})

describe('facetCounts', () => {
  it('считает типы и статусы', () => {
    const facets = facetCounts(graph)

    expect(facets.types.get('workstation')).toBe(5)
    expect(facets.types.get('container')).toBe(14)
    expect(facets.types.get('cloud')).toBe(2)
    expect(facets.statuses.get('offline')).toBe(2)
    expect(facets.statuses.get('degraded')).toBe(2)
  })

  it('сужается вместе с restrictTo', () => {
    const facets = facetCounts(graph, new Set(['keenetic-1', 'keenetic-2', 'ws-vlad']))

    expect(facets.types.get('router')).toBe(2)
    expect(facets.types.get('container')).toBeUndefined()
    expect(facets.statuses.get('offline')).toBe(1)
  })

  it('сущности без статуса не попадают в фасет статусов', () => {
    const noStatus = buildGraph([e('a'), e('b', { status: 'online' })], [])
    const facets = facetCounts(noStatus)

    expect(facets.statuses.size).toBe(1)
    expect(facets.types.get('host')).toBe(2)
  })
})

describe('applyFilters: подготовленный поиск', () => {
  const addressed = [
    e('a', { sublabels: ['10.38.24.5', 'gw 10.38.25.1'] }),
    e('b', { label: 'Core-Switch', sublabels: ['10.40.0.7'] }),
    e('c', { sublabels: ['no address here'] }),
    e('d', { sublabels: ['10.38.24.70'] }),
  ]
  const addressedGraph = buildGraph(addressed, [])
  const matched = (query: string) =>
    [...applyFilters(addressedGraph, state({ query }), { neighborDepth: 0 }).matchedIds].sort()

  it.each([
    '10.38.24.0/24',
    '10.38.0.0/16',
    '10.38.24.*',
    '10.38.24.7*',
    'switch',
    'CORE',
    '10.40',
    'nothing',
  ])('запрос %s даёт тот же ответ, что и matchesQuery', (query) => {
    const expected = addressed
      .filter((entity) => matchesQuery(defaultSearchFields(entity), query))
      .map((entity) => entity.id)
      .sort()
    expect(matched(query)).toEqual(expected)
  })

  it('совпадение не склеивается из двух соседних полей', () => {
    const graphOfOne = buildGraph([e('x', { label: 'ab', sublabels: ['cd'] })], [])
    const hits = applyFilters(graphOfOne, state({ query: 'bc' }), { neighborDepth: 0 }).matchedIds
    expect(hits.size).toBe(0)
  })

  it('изменённая сущность — новый объект, и поиск видит новые поля', () => {
    const before = e('x', { sublabels: ['10.1.1.1'] })
    expect(applyFilters(buildGraph([before], []), state({ query: '10.1.1.0/24' })).matchedIds.has('x')).toBe(
      true,
    )

    const after = { ...before, sublabels: ['10.2.2.2'] }
    expect(applyFilters(buildGraph([after], []), state({ query: '10.1.1.0/24' })).matchedIds.has('x')).toBe(
      false,
    )
  })

  it('свои searchFields получают свои записи, а не чужие из кэша', () => {
    const entity = e('x', { label: 'visible', sublabels: ['10.9.9.9'] })
    const onlyLabel = (item: AssetEntity) => [item.label]
    const graphOfOne = buildGraph([entity], [])

    expect(applyFilters(graphOfOne, state({ query: '10.9.9.0/24' })).matchedIds.has('x')).toBe(true)
    expect(
      applyFilters(graphOfOne, state({ query: '10.9.9.0/24' }), { searchFields: onlyLabel }).matchedIds.has(
        'x',
      ),
    ).toBe(false)
  })

  it('CIDR по 100 тысячам: повторный запрос не разбирает адреса заново', () => {
    // Замер: 262 мс на каждое нажатие — адреса разбирались заново каждый раз.
    const many: AssetEntity[] = []
    for (let index = 0; index < 100_000; index += 1) {
      many.push(
        e(`n${index}`, { sublabels: [`10.${(index >> 16) & 255}.${(index >> 8) & 255}.${index & 255}`] }),
      )
    }
    const big = buildGraph(many, [])
    applyFilters(big, state({ query: '10.0.0.0/24' }), { neighborDepth: 0, keepPathToRoot: false })

    const started = performance.now()
    const result = applyFilters(big, state({ query: '10.0.1.0/24' }), {
      neighborDepth: 0,
      keepPathToRoot: false,
    })
    const elapsed = performance.now() - started

    expect(result.matchedIds.size).toBe(256)
    expect(elapsed).toBeLessThan(100)
  })
})
