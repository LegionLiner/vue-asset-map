import { describe, expect, it } from 'vitest'
import { buildGraph, collapseGraph, projectGraph } from '../../src/core/index'
import { generateLargeGraph, LAYER_PHYSICAL } from '../../fixtures/infra'

const NODE_COUNT = 2000
const EDGE_COUNT = 4000

/**
 * Бюджет всего конвейера — 200 мс. Раскладка добирает свою долю в
 * `tests/layout/performance.test.ts`; здесь измеряется только часть ядра.
 */
const CORE_BUDGET_MS = 150

describe('бенчмарк ядра', () => {
  it(`индексы + проекция + свёртка на ${NODE_COUNT} узлах и ${EDGE_COUNT} рёбрах — под ${CORE_BUDGET_MS} мс`, () => {
    const { entities, links } = generateLargeGraph(NODE_COUNT, EDGE_COUNT)

    // Прогрев: первый прогон включает прогрев JIT и не отражает стоимость.
    collapseGraph(buildGraph(entities, links))

    const started = performance.now()

    const graph = buildGraph(entities, links)
    const projection = projectGraph(graph, {
      id: LAYER_PHYSICAL,
      label: 'Физическая',
      hideIsolated: false,
    })
    const collapsed = collapseGraph(graph, {
      visibleEntityIds: projection.entityIds,
      visibleLinkIds: projection.linkIds,
    })

    const elapsed = performance.now() - started

    expect(graph.entities.size).toBe(NODE_COUNT)
    expect(collapsed.groups.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(CORE_BUDGET_MS)
  })

  it('повторное построение стабильно: порядок и содержимое индексов те же', () => {
    const { entities, links } = generateLargeGraph(500, 800)

    const first = buildGraph(entities, links)
    const second = buildGraph(entities, links)

    expect([...second.entities.keys()]).toEqual([...first.entities.keys()])
    expect(second.adjacency.get('n-0')).toEqual(first.adjacency.get('n-0'))
    expect(collapseGraph(second).nodeIds).toEqual(collapseGraph(first).nodeIds)
  })
})
