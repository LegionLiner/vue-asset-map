import { describe, expect, it } from 'vitest'
import { buildGraph, collapseGraph, projectGraph } from '../../src/core/index'
import { manualLayout } from '../../src/layout/index'
import type { LayoutGraph } from '../../src/layout/types'
import { generateLargeGraph, LAYER_PHYSICAL } from '../../fixtures/infra'

const NODE_COUNT = 2000
const EDGE_COUNT = 4000
const BUDGET_MS = 200

describe('бенчмарк полного конвейера', () => {
  it(`индексы + свёртка + раскладка manual на ${NODE_COUNT} узлах и ${EDGE_COUNT} рёбрах — под ${BUDGET_MS} мс`, async () => {
    const { entities, links } = generateLargeGraph(NODE_COUNT, EDGE_COUNT)

    // Прогрев: первый прогон включает прогрев JIT и не отражает стоимость.
    await runPipeline(entities, links)

    const started = performance.now()
    const result = await runPipeline(entities, links)
    const elapsed = performance.now() - started

    expect(result.nodeCount).toBe(result.positionCount)
    expect(result.groupCount).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(BUDGET_MS)
  })
})

async function runPipeline(
  entities: Parameters<typeof buildGraph>[0],
  links: Parameters<typeof buildGraph>[1],
): Promise<{ nodeCount: number; positionCount: number; groupCount: number }> {
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

  const layoutGraph: LayoutGraph = {
    nodes: collapsed.nodeIds.map((id) => {
      const pinned = graph.entities.get(id)?.position
      return { id, width: 180, height: 72, ...(pinned ? { pinned } : {}) }
    }),
    edges: collapsed.links.map((link) => ({
      id: link.id,
      source: link.source,
      target: link.target,
    })),
  }

  const positions = await manualLayout.run(layoutGraph)

  return {
    nodeCount: collapsed.nodeIds.length,
    positionCount: positions.size,
    groupCount: collapsed.groups.length,
  }
}
