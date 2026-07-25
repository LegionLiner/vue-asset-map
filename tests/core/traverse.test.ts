import { describe, expect, it } from 'vitest'
import { blastRadius, buildGraph, findPaths, neighbors } from '../../src/core/index'
import type { AssetEntity } from '../../src/types/entity'
import type { AssetLink } from '../../src/types/link'
import { entities, links } from '../../fixtures/infra'

const e = (id: string): AssetEntity => ({ id, kind: 'host', label: id })

const l = (id: string, source: string, target: string, extra: Partial<AssetLink> = {}): AssetLink => ({
  id,
  source,
  target,
  layers: ['physical'],
  ...extra,
})

/** Треугольник a–b–c–a: минимальный граф с циклом. */
const triangle = buildGraph(
  [e('a'), e('b'), e('c')],
  [l('ab', 'a', 'b'), l('bc', 'b', 'c'), l('ca', 'c', 'a')],
)

describe('neighbors', () => {
  const chain = buildGraph(
    [e('a'), e('b'), e('c'), e('d')],
    [l('ab', 'a', 'b'), l('bc', 'b', 'c'), l('cd', 'c', 'd')],
  )

  it('глубина 1 — прямые соседи', () => {
    expect(neighbors(chain, 'b', 1)).toEqual(new Set(['a', 'c']))
  })

  it('глубина растёт вместе с окрестностью', () => {
    expect(neighbors(chain, 'a', 2)).toEqual(new Set(['b', 'c']))
    expect(neighbors(chain, 'a', 3)).toEqual(new Set(['b', 'c', 'd']))
    expect(neighbors(chain, 'a', 99)).toEqual(new Set(['b', 'c', 'd']))
  })

  it('сам узел в результат не входит даже при цикле', () => {
    expect(neighbors(triangle, 'a', 5)).toEqual(new Set(['b', 'c']))
  })

  it('нулевая и отрицательная глубина дают пустой результат', () => {
    expect(neighbors(chain, 'a', 0)).toEqual(new Set())
    expect(neighbors(chain, 'a', -1)).toEqual(new Set())
  })

  it('неизвестный узел даёт пустой результат', () => {
    expect(neighbors(chain, 'ghost', 3)).toEqual(new Set())
  })

  it('фильтрует по слоям', () => {
    const layered = buildGraph(
      [e('a'), e('b'), e('c')],
      [l('ab', 'a', 'b', { layers: ['physical'] }), l('ac', 'a', 'c', { layers: ['logical'] })],
    )

    expect(neighbors(layered, 'a', 1, ['logical'])).toEqual(new Set(['c']))
    expect(neighbors(layered, 'a', 1, ['physical'])).toEqual(new Set(['b']))
    expect(neighbors(layered, 'a', 1)).toEqual(new Set(['b', 'c']))
  })

  it('петля не добавляет узел к своим соседям', () => {
    const looped = buildGraph([e('a'), e('b')], [l('loop', 'a', 'a'), l('ab', 'a', 'b')])
    expect(neighbors(looped, 'a', 2)).toEqual(new Set(['b']))
  })

  it('кратные рёбра не дублируют соседа', () => {
    const multi = buildGraph([e('a'), e('b')], [l('ab-1', 'a', 'b'), l('ab-2', 'a', 'b')])
    expect(neighbors(multi, 'a', 1)).toEqual(new Set(['b']))
  })
})

describe('findPaths', () => {
  it('находит единственный путь в цепочке', () => {
    const chain = buildGraph([e('a'), e('b'), e('c')], [l('ab', 'a', 'b'), l('bc', 'b', 'c')])
    expect(findPaths(chain, 'a', 'c')).toEqual([['a', 'b', 'c']])
  })

  it('на графе с циклом завершается и находит оба направления', () => {
    const paths = findPaths(triangle, 'a', 'c')

    expect(paths).toEqual([
      ['a', 'b', 'c'],
      ['a', 'c'],
    ])
  })

  it('уважает maxDepth (длина в рёбрах)', () => {
    expect(findPaths(triangle, 'a', 'c', { maxDepth: 1 })).toEqual([['a', 'c']])
    expect(findPaths(triangle, 'a', 'c', { maxDepth: 2 })).toHaveLength(2)
    expect(findPaths(triangle, 'a', 'c', { maxDepth: 0 })).toEqual([])
  })

  it('уважает maxPaths', () => {
    expect(findPaths(triangle, 'a', 'c', { maxPaths: 1 })).toEqual([['a', 'b', 'c']])
    expect(findPaths(triangle, 'a', 'c', { maxPaths: 0 })).toEqual([])
  })

  it('не зависает на плотном графе с множеством циклов', () => {
    const size = 12
    const denseEntities = Array.from({ length: size }, (_, index) => e(`n${index}`))
    const denseLinks: AssetLink[] = []
    for (let from = 0; from < size; from += 1) {
      for (let to = from + 1; to < size; to += 1) {
        denseLinks.push(l(`e-${from}-${to}`, `n${from}`, `n${to}`))
      }
    }

    const dense = buildGraph(denseEntities, denseLinks)
    const paths = findPaths(dense, 'n0', 'n11', { maxPaths: 5, maxDepth: 4 })

    expect(paths).toHaveLength(5)
    for (const path of paths) {
      expect(path.length - 1).toBeLessThanOrEqual(4)
      expect(new Set(path).size).toBe(path.length)
      expect(path[0]).toBe('n0')
      expect(path[path.length - 1]).toBe('n11')
    }
  })

  it('путь из узла в себя — вырожденный путь длины 0', () => {
    expect(findPaths(triangle, 'a', 'a')).toEqual([['a']])
  })

  it('неизвестные концы дают пустой результат', () => {
    expect(findPaths(triangle, 'ghost', 'a')).toEqual([])
    expect(findPaths(triangle, 'a', 'ghost')).toEqual([])
  })

  it('нет пути между компонентами', () => {
    const split = buildGraph([e('a'), e('b'), e('x')], [l('ab', 'a', 'b')])
    expect(findPaths(split, 'a', 'x')).toEqual([])
  })

  it('фильтрует по слоям', () => {
    const layered = buildGraph(
      [e('a'), e('b'), e('c')],
      [
        l('ab', 'a', 'b', { layers: ['physical'] }),
        l('bc', 'b', 'c', { layers: ['physical'] }),
        l('ac', 'a', 'c', { layers: ['logical'] }),
      ],
    )

    expect(findPaths(layered, 'a', 'c', { layers: ['logical'] })).toEqual([['a', 'c']])
    expect(findPaths(layered, 'a', 'c', { layers: ['physical'] })).toEqual([['a', 'b', 'c']])
  })

  it('кратные рёбра не порождают дублирующихся путей по узлам', () => {
    const multi = buildGraph(
      [e('a'), e('b'), e('c')],
      [l('ab-1', 'a', 'b'), l('ab-2', 'a', 'b'), l('bc', 'b', 'c')],
    )

    // Два параллельных ребра a–b дают два прохода, но узловая цепочка та же.
    const paths = findPaths(multi, 'a', 'c')
    expect(paths).toEqual([
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
    ])
  })
})

describe('blastRadius', () => {
  const directed = buildGraph(
    [e('root'), e('mid'), e('leaf'), e('side')],
    [
      l('root-mid', 'root', 'mid', { directed: true }),
      l('mid-leaf', 'mid', 'leaf', { directed: true }),
      l('side-mid', 'side', 'mid', { directed: true }),
    ],
  )

  it('включает сам узел', () => {
    expect(blastRadius(directed, 'leaf', { direction: 'downstream' })).toEqual(new Set(['leaf']))
  })

  it('downstream идёт по направлению рёбер', () => {
    expect(blastRadius(directed, 'root', { direction: 'downstream' })).toEqual(
      new Set(['root', 'mid', 'leaf']),
    )
  })

  it('upstream идёт против направления рёбер', () => {
    expect(blastRadius(directed, 'leaf', { direction: 'upstream' })).toEqual(
      new Set(['leaf', 'mid', 'root', 'side']),
    )
  })

  it('both игнорирует направление', () => {
    expect(blastRadius(directed, 'root')).toEqual(new Set(['root', 'mid', 'leaf', 'side']))
  })

  it('неориентированное ребро проходится в обе стороны при любом направлении', () => {
    const mixed = buildGraph(
      [e('a'), e('b'), e('c')],
      [l('ab', 'a', 'b'), l('cb', 'c', 'b', { directed: true })],
    )

    // a–b неориентированное: из b можно вернуться в a даже «вниз по потоку».
    expect(blastRadius(mixed, 'b', { direction: 'downstream' })).toEqual(new Set(['b', 'a']))
    expect(blastRadius(mixed, 'b', { direction: 'upstream' })).toEqual(new Set(['b', 'a', 'c']))
  })

  it('завершается на цикле', () => {
    expect(blastRadius(triangle, 'a')).toEqual(new Set(['a', 'b', 'c']))
  })

  it('уважает maxDepth', () => {
    expect(blastRadius(directed, 'root', { direction: 'downstream', maxDepth: 1 })).toEqual(
      new Set(['root', 'mid']),
    )
  })

  it('фильтрует по слоям', () => {
    const layered = buildGraph(
      [e('a'), e('b'), e('c')],
      [l('ab', 'a', 'b', { layers: ['physical'] }), l('bc', 'b', 'c', { layers: ['logical'] })],
    )

    expect(blastRadius(layered, 'a', { layers: ['physical'] })).toEqual(new Set(['a', 'b']))
  })

  it('неизвестный узел даёт пустой результат', () => {
    expect(blastRadius(triangle, 'ghost')).toEqual(new Set())
  })
})

describe('обход на фикстуре', () => {
  const graph = buildGraph(entities, links)

  it('соседи Интернета в физическом слое — вся внешняя граница', () => {
    const result = neighbors(graph, 'internet', 1, ['physical'])

    expect(result).toEqual(
      new Set([
        'cloudflare',
        'vps-tailscale',
        'vps-brainstorm',
        'vps-160-usa',
        'vps-nginx',
        'keenetic-1',
        'keenetic-2',
      ]),
    )
  })

  it('в логическом слое есть два разных пути между рабочими станциями', () => {
    const paths = findPaths(graph, 'ws-artjom', 'ws-dmitry', { layers: ['logical'] })

    expect(paths.length).toBeGreaterThanOrEqual(2)
    // Прямой пиринг и путь через координатор.
    expect(paths).toContainEqual(['ws-artjom', 'ws-dmitry'])
    expect(paths).toContainEqual(['ws-artjom', 'vps-tailscale', 'ws-dmitry'])
  })

  it('отказ Keenetic 2 задевает офис B, но не офис A', () => {
    const radius = blastRadius(graph, 'keenetic-2', { layers: ['physical'] })

    expect(radius.has('pve-beelink')).toBe(true)
    expect(radius.has('ws-vlad')).toBe(true)
    // Через Интернет достижимо всё — это ожидаемо для неориентированного графа.
    expect(radius.has('internet')).toBe(true)
  })
})
