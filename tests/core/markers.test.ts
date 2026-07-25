import { describe, expect, it } from 'vitest'
import { buildGraph, connectionMarkers, topAnchors } from '../../src/core/index'
import type { NetworkEntity } from '../../src/types/entity'
import type { NetworkLink } from '../../src/types/link'
import { entities, links } from '../../fixtures/infra'

const graph = buildGraph(entities, links)

/** Состав маркера как множество id. */
function membersOf(marker: { members?: (g: typeof graph) => Iterable<string> }): Set<string> {
  return new Set(marker.members ? marker.members(graph) : [])
}

describe('connectionMarkers', () => {
  it('даёт по маркеру на каждый опорный узел, сохраняя порядок', () => {
    const markers = connectionMarkers([
      { id: 'keenetic-1', label: 'Keenetic 1' },
      { id: 'vps-tailscale', label: 'Tailscale VPS' },
    ])

    expect(markers.map((marker) => marker.id)).toEqual(['keenetic-1', 'vps-tailscale'])
    expect(markers[0]?.label).toBe('Keenetic 1')
  })

  it('участники маркера — сам опорный узел и всё, что с ним связано', () => {
    const [keenetic] = connectionMarkers([{ id: 'keenetic-1' }])
    expect(keenetic).toBeDefined()
    if (!keenetic) return

    const members = membersOf(keenetic)

    expect(members.has('keenetic-1')).toBe(true)
    expect(members.has('ws-artjom')).toBe(true)
    expect(members.has('pve-artjom')).toBe(true)
    expect(members.has('internet')).toBe(true)
    // Офис B к первому роутеру не подключён.
    expect(members.has('ws-vlad')).toBe(false)
  })

  it('связи всех слоёв учитываются: узел принадлежит и роутеру, и координатору VPN', () => {
    const [keenetic, tailscale] = connectionMarkers([{ id: 'keenetic-1' }, { id: 'vps-tailscale' }])
    expect(keenetic && tailscale).toBeDefined()
    if (!keenetic || !tailscale) return

    // Именно это и нужно: `Artjom` подключён к роутеру физически и к
    // координатору логически, поэтому он есть в обоих маркерах.
    expect(membersOf(keenetic).has('ws-artjom')).toBe(true)
    expect(membersOf(tailscale).has('ws-artjom')).toBe(true)
  })

  it('слои можно ограничить, тогда принадлежность считается только по ним', () => {
    const [physicalOnly] = connectionMarkers([{ id: 'vps-tailscale' }], { layers: ['physical'] })
    expect(physicalOnly).toBeDefined()
    if (!physicalOnly) return

    const members = membersOf(physicalOnly)
    // В физическом слое у координатора единственная связь — Интернет.
    expect(members.has('internet')).toBe(true)
    expect(members.has('ws-artjom')).toBe(false)
  })

  it('глубина расширяет принадлежность', () => {
    const [near] = connectionMarkers([{ id: 'keenetic-2' }], { depth: 1 })
    const [far] = connectionMarkers([{ id: 'keenetic-2' }], { depth: 2 })
    expect(near && far).toBeDefined()
    if (!near || !far) return

    // Контейнеры висят на гипервизоре, тот — на роутере: два шага.
    expect(membersOf(near).has('ct-web-1')).toBe(false)
    expect(membersOf(far).has('ct-web-1')).toBe(true)
  })

  it('includeAnchor: false исключает сам опорный узел', () => {
    const [without] = connectionMarkers([{ id: 'keenetic-1' }], { includeAnchor: false })
    expect(without).toBeDefined()
    if (!without) return

    const members = membersOf(without)
    expect(members.has('keenetic-1')).toBe(false)
    expect(members.has('ws-artjom')).toBe(true)
  })

  it('опорный узел, которого нет в данных, даёт пустой маркер без падения', () => {
    const [ghost] = connectionMarkers([{ id: 'no-such-node' }])
    expect(ghost).toBeDefined()
    if (!ghost) return

    expect(membersOf(ghost).size).toBe(0)
  })

  it('свой цвет опорного узла попадает в маркер', () => {
    const [colored] = connectionMarkers([{ id: 'keenetic-1', color: '#123456' }])
    expect(colored?.color).toBe('#123456')
  })

  it('состав детерминирован: повторный вызов даёт то же множество', () => {
    const [first] = connectionMarkers([{ id: 'keenetic-2' }])
    const [second] = connectionMarkers([{ id: 'keenetic-2' }])
    expect(first && second).toBeDefined()
    if (!first || !second) return

    expect([...membersOf(first)]).toEqual([...membersOf(second)])
  })
})

describe('topAnchors', () => {
  it('возвращает самые связанные узлы', () => {
    const anchors = topAnchors(graph, 3)

    // Интернет — центр физической топологии, координатор — центр оверлея.
    expect(anchors.map((anchor) => anchor.id)).toContain('internet')
    expect(anchors.map((anchor) => anchor.id)).toContain('vps-tailscale')
    expect(anchors).toHaveLength(3)
  })

  it('подставляет подписи из данных', () => {
    const [first] = topAnchors(graph, 1)
    expect(first?.label).toBe(graph.entities.get(first?.id ?? '')?.label)
  })

  it('учитывает только указанные слои', () => {
    const logical = topAnchors(graph, 1, ['logical'])
    // В оверлее самый связанный — координатор VPN.
    expect(logical[0]?.id).toBe('vps-tailscale')
  })

  it('изолированные узлы в опорные не попадают', () => {
    const lonely = buildGraph(
      [
        { id: 'a', kind: 'host', label: 'A' },
        { id: 'b', kind: 'host', label: 'B' },
        { id: 'alone', kind: 'host', label: 'Alone' },
      ] satisfies NetworkEntity[],
      [{ id: 'ab', source: 'a', target: 'b', layers: ['physical'] }] satisfies NetworkLink[],
    )

    expect(topAnchors(lonely, 5).map((anchor) => anchor.id)).toEqual(['a', 'b'])
  })

  it('сортирует по убыванию степени', () => {
    const anchors = topAnchors(graph, 30)
    const degreeOf = (id: string): number => graph.adjacency.get(id)?.length ?? 0

    for (let index = 1; index < anchors.length; index += 1) {
      const previous = anchors[index - 1]
      const current = anchors[index]
      if (!previous || !current) continue
      expect(degreeOf(previous.id)).toBeGreaterThanOrEqual(degreeOf(current.id))
    }
  })

  it('при равной степени порядок остаётся входным', () => {
    // Звезда с двумя равными лучами: у `b` и `c` по одной связи.
    const equal = buildGraph(
      [
        { id: 'hub', kind: 'host', label: 'Hub' },
        { id: 'b', kind: 'host', label: 'B' },
        { id: 'c', kind: 'host', label: 'C' },
      ] satisfies NetworkEntity[],
      [
        { id: 'hb', source: 'hub', target: 'b', layers: ['physical'] },
        { id: 'hc', source: 'hub', target: 'c', layers: ['physical'] },
      ] satisfies NetworkLink[],
    )

    expect(topAnchors(equal, 3).map((anchor) => anchor.id)).toEqual(['hub', 'b', 'c'])
  })

  it('нулевой и отрицательный запрос даёт пустой список', () => {
    expect(topAnchors(graph, 0)).toEqual([])
    expect(topAnchors(graph, -3)).toEqual([])
  })
})
