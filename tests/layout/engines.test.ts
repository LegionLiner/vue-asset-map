import { describe, expect, it } from 'vitest'
import {
  builtinLayoutEngines,
  isLayoutAborted,
  LayoutAbortedError,
  manualLayout,
  radialLayout,
  resolveLayoutEngine,
} from '../../src/layout/index'
import { dagreLayout } from '../../src/layout/dagre'
import type { LayoutEngine, LayoutGraph, LayoutNode } from '../../src/layout/types'
import { buildGraph, collapseGraph } from '../../src/core/index'
import { entities, links } from '../../fixtures/infra'

/** Все движки проверяются одним и тем же набором инвариантов. */
const engines: LayoutEngine[] = [manualLayout, radialLayout, dagreLayout]

function star(leaves: number): LayoutGraph {
  const nodes: LayoutNode[] = [{ id: 'root', width: 160, height: 64 }]
  const edges: LayoutGraph['edges'] = []
  for (let index = 1; index <= leaves; index += 1) {
    nodes.push({ id: `leaf-${index}`, width: 160, height: 64 })
    edges.push({ id: `e-${index}`, source: 'root', target: `leaf-${index}` })
  }
  return { nodes, edges }
}

describe.each(engines.map((engine) => [engine.name, engine] as const))(
  'движок %s: общие инварианты',
  (name, engine) => {
    it('возвращает позицию для каждого узла', async () => {
      const positions = await engine.run(star(6))

      expect(positions.size).toBe(7)
      for (const [, position] of positions) {
        expect(Number.isFinite(position.x)).toBe(true)
        expect(Number.isFinite(position.y)).toBe(true)
      }
    })

    it('детерминирован: два прогона дают идентичные позиции', async () => {
      const graph = star(9)
      const first = await engine.run(graph)
      const second = await engine.run(graph)

      expect([...second.entries()]).toEqual([...first.entries()])
    })

    it('устойчив к порядку вызовов: результат не зависит от предыдущих прогонов', async () => {
      const graph = star(5)
      const baseline = await engine.run(graph)
      await engine.run(star(30))
      const repeat = await engine.run(graph)

      expect([...repeat.entries()]).toEqual([...baseline.entries()])
    })

    it('не перезаписывает pinned-позиции', async () => {
      const graph = star(6)
      const pinnedNode = graph.nodes[2]
      expect(pinnedNode).toBeDefined()
      if (!pinnedNode) return
      pinnedNode.pinned = { x: 1234, y: -567 }

      const positions = await engine.run(graph)

      expect(positions.get(pinnedNode.id)).toEqual({ x: 1234, y: -567 })
    })

    it('pinned не влияет на то, что остальные узлы разложены', async () => {
      const graph = star(6)
      for (const node of graph.nodes) node.pinned = { x: 10, y: 20 }

      const positions = await engine.run(graph)

      expect(positions.size).toBe(graph.nodes.length)
      for (const [, position] of positions) expect(position).toEqual({ x: 10, y: 20 })
    })

    it('уже отменённый запрос не выполняется', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(engine.run(star(4), undefined, controller.signal)).rejects.toBeInstanceOf(
        LayoutAbortedError,
      )
    })

    it('отмена сразу после вызова отбрасывает результат', async () => {
      const controller = new AbortController()
      const pending = engine.run(star(4), undefined, controller.signal)
      controller.abort()

      await expect(pending).rejects.toSatisfy(isLayoutAborted)
    })

    it('пустой граф даёт пустой результат, а не падение', async () => {
      const positions = await engine.run({ nodes: [], edges: [] })
      expect(positions.size).toBe(0)
    })

    it('рёбра в несуществующие узлы игнорируются', async () => {
      const graph = star(3)
      graph.edges.push({ id: 'ghost', source: 'root', target: 'nope' })

      const positions = await engine.run(graph)
      expect(positions.size).toBe(4)
      expect(positions.has('nope')).toBe(false)
    })

    it(`имя движка — ${name}`, () => {
      expect(engine.name).toBe(name)
    })
  },
)

describe('manual', () => {
  it('выкладывает незакреплённые узлы в сетку по порядку входного массива', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
        { id: 'c', width: 100, height: 50 },
      ],
      edges: [],
    }

    const positions = await manualLayout.run(graph, { columns: 2, columnGap: 200, rowGap: 100 })

    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('b')).toEqual({ x: 200, y: 0 })
    expect(positions.get('c')).toEqual({ x: 0, y: 100 })
  })

  it('origin сдвигает всю сетку', async () => {
    const graph: LayoutGraph = { nodes: [{ id: 'a', width: 10, height: 10 }], edges: [] }
    const positions = await manualLayout.run(graph, { origin: { x: 50, y: 70 } })

    expect(positions.get('a')).toEqual({ x: 50, y: 70 })
  })

  it('закреплённые узлы не занимают мест в сетке', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'pinned', width: 100, height: 50, pinned: { x: 999, y: 999 } },
        { id: 'a', width: 100, height: 50 },
      ],
      edges: [],
    }

    const positions = await manualLayout.run(graph, { columns: 2, columnGap: 200, rowGap: 100 })

    // `a` встаёт первым в сетке, несмотря на то что в массиве он второй.
    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('pinned')).toEqual({ x: 999, y: 999 })
  })

  it('columns не может быть меньше единицы', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'a', width: 10, height: 10 },
        { id: 'b', width: 10, height: 10 },
      ],
      edges: [],
    }

    const positions = await manualLayout.run(graph, { columns: 0, columnGap: 100, rowGap: 100 })
    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(positions.get('b')).toEqual({ x: 0, y: 100 })
  })
})

describe('radial', () => {
  it('корень встаёт в центр, остальные — на кольца по числу хопов', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'root', width: 100, height: 50 },
        { id: 'mid', width: 100, height: 50 },
        { id: 'far', width: 100, height: 50 },
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'mid' },
        { id: 'e2', source: 'mid', target: 'far' },
      ],
    }

    const positions = await radialLayout.run(graph, {
      rootId: 'root',
      radius: 100,
      ringGap: 100,
      center: { x: 0, y: 0 },
    })

    expect(positions.get('root')).toEqual({ x: 0, y: 0 })
    expect(distance(positions.get('mid'))).toBeCloseTo(100)
    expect(distance(positions.get('far'))).toBeCloseTo(200)
  })

  it('узлы одного кольца равномерно распределены по окружности', async () => {
    const positions = await radialLayout.run(star(4), {
      rootId: 'root',
      radius: 100,
      center: { x: 0, y: 0 },
      startAngle: 0,
    })

    expect(positions.get('leaf-1')).toEqual({ x: 100, y: 0 })
    expect(positions.get('leaf-2')?.x).toBeCloseTo(0)
    expect(positions.get('leaf-2')?.y).toBeCloseTo(100)
    expect(positions.get('leaf-3')?.x).toBeCloseTo(-100)
    expect(positions.get('leaf-4')?.y).toBeCloseTo(-100)
  })

  it('без rootId центром становится узел наибольшей степени', async () => {
    const positions = await radialLayout.run(star(5), { center: { x: 7, y: 7 } })
    expect(positions.get('root')).toEqual({ x: 7, y: 7 })
  })

  it('при равных степенях корнем становится первый по порядку', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'a', width: 10, height: 10 },
        { id: 'b', width: 10, height: 10 },
      ],
      edges: [{ id: 'ab', source: 'a', target: 'b' }],
    }

    const positions = await radialLayout.run(graph, { center: { x: 0, y: 0 } })
    expect(positions.get('a')).toEqual({ x: 0, y: 0 })
  })

  it('несвязанные узлы получают внешнее кольцо, а не теряются', async () => {
    const graph = star(3)
    graph.nodes.push({ id: 'orphan-1', width: 10, height: 10 })
    graph.nodes.push({ id: 'orphan-2', width: 10, height: 10 })

    const positions = await radialLayout.run(graph, { rootId: 'root', radius: 100, ringGap: 100 })

    expect(positions.size).toBe(6)
    expect(distance(positions.get('orphan-1'))).toBeCloseTo(200)
    expect(distance(positions.get('orphan-2'))).toBeCloseTo(200)
  })

  it('неизвестный rootId откатывается на автовыбор', async () => {
    const positions = await radialLayout.run(star(4), { rootId: 'ghost', center: { x: 0, y: 0 } })
    expect(positions.get('root')).toEqual({ x: 0, y: 0 })
  })
})

describe('dagre', () => {
  it('раскладывает по ярусам: потомок ниже родителя при rankdir TB', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'root', width: 100, height: 50 },
        { id: 'child', width: 100, height: 50 },
      ],
      edges: [{ id: 'e', source: 'root', target: 'child' }],
    }

    const positions = await dagreLayout.run(graph, { rankdir: 'TB', ranksep: 100 })
    const root = positions.get('root')
    const child = positions.get('child')

    expect(root && child && child.y > root.y).toBe(true)
  })

  it('rankdir LR раскладывает по горизонтали', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'root', width: 100, height: 50 },
        { id: 'child', width: 100, height: 50 },
      ],
      edges: [{ id: 'e', source: 'root', target: 'child' }],
    }

    const positions = await dagreLayout.run(graph, { rankdir: 'LR' })
    const root = positions.get('root')
    const child = positions.get('child')

    expect(root && child && child.x > root.x).toBe(true)
  })

  it('параллельные рёбра не схлопываются в один ярус-переход', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'b' },
      ],
    }

    const positions = await dagreLayout.run(graph)
    expect(positions.size).toBe(2)
  })

  it('позиции — левый верхний угол, а не центр узла', async () => {
    const graph: LayoutGraph = { nodes: [{ id: 'solo', width: 200, height: 100 }], edges: [] }
    const positions = await dagreLayout.run(graph)

    // Единственный узел dagre ставит центром в (width/2, height/2).
    expect(positions.get('solo')).toEqual({ x: 0, y: 0 })
  })

  it('переживает граф с циклом', async () => {
    const graph: LayoutGraph = {
      nodes: [
        { id: 'a', width: 100, height: 50 },
        { id: 'b', width: 100, height: 50 },
        { id: 'c', width: 100, height: 50 },
      ],
      edges: [
        { id: 'ab', source: 'a', target: 'b' },
        { id: 'bc', source: 'b', target: 'c' },
        { id: 'ca', source: 'c', target: 'a' },
      ],
    }

    const positions = await dagreLayout.run(graph)
    expect(positions.size).toBe(3)
  })
})

describe('реестр движков', () => {
  it('содержит manual и radial, но не dagre', () => {
    expect(Object.keys(builtinLayoutEngines).sort()).toEqual(['manual', 'radial'])
  })

  it('resolveLayoutEngine находит движок по имени', () => {
    expect(resolveLayoutEngine('manual')).toBe(manualLayout)
    expect(resolveLayoutEngine('radial')).toBe(radialLayout)
  })

  it('объект движка возвращается как есть', () => {
    expect(resolveLayoutEngine(dagreLayout)).toBe(dagreLayout)
  })

  it('дополнительный реестр перекрывает встроенный', () => {
    const fake: LayoutEngine = { name: 'manual', run: async () => new Map() }
    expect(resolveLayoutEngine('manual', { manual: fake })).toBe(fake)
  })

  it('неизвестное имя даёт undefined, а не исключение', () => {
    expect(resolveLayoutEngine('nope')).toBeUndefined()
    expect(resolveLayoutEngine(undefined)).toBeUndefined()
  })
})

describe('раскладка схлопнутого графа из фикстуры', () => {
  it('получает по позиции на каждый узел, включая групповой', async () => {
    const graph = buildGraph(entities, links)
    const collapsed = collapseGraph(graph)

    const layoutGraph: LayoutGraph = {
      nodes: collapsed.nodeIds.map((id) => ({ id, width: 180, height: 72 })),
      edges: collapsed.links.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
      })),
    }

    const positions = await radialLayout.run(layoutGraph, { rootId: 'internet' })

    expect(positions.size).toBe(collapsed.nodeIds.length)
    expect(positions.get('internet')).toEqual({ x: 0, y: 0 })
    expect(positions.has('group:pve-beelink:container')).toBe(true)
  })
})

function distance(position: { x: number; y: number } | undefined): number {
  if (!position) return Number.NaN
  return Math.sqrt(position.x ** 2 + position.y ** 2)
}
