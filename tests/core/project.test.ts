import { describe, expect, it } from 'vitest'
import { buildGraph, defaultLinkFilter, projectGraph, resolveView } from '../../src/core/index'
import type { NetworkEntity } from '../../src/types/entity'
import type { NetworkLink } from '../../src/types/link'
import type { NetworkView } from '../../src/types/view'
import { entities, links, views } from '../../fixtures/infra'

const e = (id: string, extra: Partial<NetworkEntity> = {}): NetworkEntity => ({
  id,
  kind: 'host',
  label: id,
  ...extra,
})

const l = (id: string, source: string, target: string, layers: string[]): NetworkLink => ({
  id,
  source,
  target,
  layers,
})

const physical: NetworkView = { id: 'physical', label: 'Физическая' }
const logical: NetworkView = { id: 'logical', label: 'Логическая' }

describe('projectGraph', () => {
  it('без вида показывает всё', () => {
    const graph = buildGraph([e('a'), e('b')], [l('ab', 'a', 'b', ['physical'])])
    const result = projectGraph(graph)

    expect([...result.entityIds]).toEqual(['a', 'b'])
    expect([...result.linkIds]).toEqual(['ab'])
  })

  it('дефолтный отбор рёбер — по слою, совпадающему с id вида', () => {
    const graph = buildGraph(
      [e('a'), e('b')],
      [l('p', 'a', 'b', ['physical']), l('o', 'a', 'b', ['logical'])],
    )

    expect([...projectGraph(graph, physical).linkIds]).toEqual(['p'])
    expect([...projectGraph(graph, logical).linkIds]).toEqual(['o'])
  })

  it('ребро с несколькими слоями попадает в оба вида', () => {
    const graph = buildGraph([e('a'), e('b')], [l('both', 'a', 'b', ['physical', 'logical'])])

    expect([...projectGraph(graph, physical).linkIds]).toEqual(['both'])
    expect([...projectGraph(graph, logical).linkIds]).toEqual(['both'])
  })

  it('узел без связей в текущем виде: скрыт при hideIsolated, остаётся без него', () => {
    const graph = buildGraph([e('a'), e('b'), e('lonely')], [l('ab', 'a', 'b', ['physical'])])

    const withoutFlag = projectGraph(graph, logical)
    expect(withoutFlag.entityIds.has('lonely')).toBe(true)
    // В логическом виде нет ни одной связи, но и скрывать никого не просили.
    expect([...withoutFlag.entityIds]).toEqual(['a', 'b', 'lonely'])
    expect(withoutFlag.linkIds.size).toBe(0)

    const hidden = projectGraph(graph, { ...physical, hideIsolated: true })
    expect(hidden.entityIds.has('lonely')).toBe(false)
    expect([...hidden.entityIds]).toEqual(['a', 'b'])
  })

  it('hideIsolated буквален: предок не спасает связанного потомка и наоборот', () => {
    const graph = buildGraph(
      [e('router'), e('host', { parentId: 'router' }), e('peer')],
      [l('hp', 'host', 'peer', ['physical'])],
    )

    const result = projectGraph(graph, { ...physical, hideIsolated: true })
    expect([...result.entityIds]).toEqual(['host', 'peer'])
  })

  it('entityFilter применяется до отбора рёбер: ребро в отфильтрованный узел исчезает', () => {
    const graph = buildGraph([e('a'), e('b', { kind: 'skipme' })], [l('ab', 'a', 'b', ['physical'])])

    const result = projectGraph(graph, {
      ...physical,
      entityFilter: (entity) => entity.kind !== 'skipme',
    })

    expect([...result.entityIds]).toEqual(['a'])
    expect(result.linkIds.size).toBe(0)
  })

  it('свой linkFilter полностью заменяет отбор по слою', () => {
    const graph = buildGraph(
      [e('a'), e('b')],
      [l('p', 'a', 'b', ['physical']), l('o', 'a', 'b', ['logical'])],
    )

    const result = projectGraph(graph, { ...physical, linkFilter: (link) => link.id === 'o' })
    expect([...result.linkIds]).toEqual(['o'])
  })

  it('defaultLinkFilter доступен отдельно и совпадает с дефолтом', () => {
    const filter = defaultLinkFilter(physical)
    expect(filter(l('p', 'a', 'b', ['physical']))).toBe(true)
    expect(filter(l('o', 'a', 'b', ['logical']))).toBe(false)
  })
})

describe('projectGraph на фикстуре', () => {
  const graph = buildGraph(entities, links)

  it('физический вид показывает всю инфраструктуру', () => {
    const result = projectGraph(graph, views[0])
    expect(result.entityIds.size).toBe(entities.length)
  })

  it('логический вид оставляет только участников оверлея', () => {
    const result = projectGraph(graph, views[1])

    // Облака, американский VPS и контейнеры в оверлее не участвуют.
    expect(result.entityIds.has('internet')).toBe(false)
    expect(result.entityIds.has('cloudflare')).toBe(false)
    expect(result.entityIds.has('vps-160-usa')).toBe(false)
    expect(result.entityIds.has('ct-web-1')).toBe(false)
    // Роутеры тоже: у них нет собственных оверлейных связей.
    expect(result.entityIds.has('keenetic-1')).toBe(false)

    expect(result.entityIds.has('vps-tailscale')).toBe(true)
    expect(result.entityIds.has('ws-dmitry')).toBe(true)
    expect(result.entityIds.has('pve-beelink')).toBe(true)
  })
})

describe('resolveView', () => {
  it('без списка видов возвращает undefined', () => {
    expect(resolveView(undefined, 'physical')).toBeUndefined()
    expect(resolveView([], 'physical')).toBeUndefined()
  })

  it('без id берёт первый вид', () => {
    expect(resolveView([physical, logical], undefined)).toBe(physical)
  })

  it('неизвестный id сводится к первому виду', () => {
    expect(resolveView([physical, logical], 'nope')).toBe(physical)
    expect(resolveView([physical, logical], 'logical')).toBe(logical)
  })
})
