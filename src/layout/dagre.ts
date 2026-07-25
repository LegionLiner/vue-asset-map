/*
 * Default import, not `import * as dagre`.
 *
 * `@dagrejs/dagre` is CommonJS, and Node ESM builds the namespace object by
 * static analysis: it detects `graphlib` on `module.exports` but not `layout`, so
 * `dagre.layout` comes out `undefined` — in plain Node only, since bundlers and
 * Vitest supply their own interop. The failure is visible only on the built
 * package, which is what `scripts/verify-dist.mjs` guards.
 */
import dagre from '@dagrejs/dagre'
import type { EntityId, XY } from '../types/entity'
import type { LayoutEngine, LayoutGraph } from './types'
import { applyPinned, yieldAndCheck } from './shared'

/** Options of {@link dagreLayout}; passed straight through to dagre. */
export interface DagreLayoutOptions {
  /**
   * Rank direction: top-to-bottom, left-to-right and so on.
   *
   * @default 'TB'
   */
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL'
  /** Alignment within a rank. */
  align?: 'UL' | 'UR' | 'DL' | 'DR'
  /**
   * Gap between nodes of one rank, in px.
   *
   * @default 48
   */
  nodesep?: number
  /**
   * Gap between ranks, in px.
   *
   * @default 96
   */
  ranksep?: number
  /**
   * Gap between edges, in px.
   *
   * @default 24
   */
  edgesep?: number
  /**
   * Rank assignment algorithm.
   *
   * @default 'network-simplex'
   */
  ranker?: 'network-simplex' | 'tight-tree' | 'longest-path'
}

const DEFAULTS = {
  rankdir: 'TB',
  nodesep: 48,
  ranksep: 96,
  edgesep: 24,
  ranker: 'network-simplex',
} as const

/**
 * Layered layout backed by dagre.
 *
 * Lives behind the separate `vue-asset-map/layout-dagre` subpath, with
 * `@dagrejs/dagre` in `optionalDependencies`: not everyone needs the engine, and
 * it outweighs the rest of the core. Importing this module is the opt-in.
 *
 * Dagre cannot fix nodes in place, so pinned positions are re-applied over its
 * output — from outside, behaviour matches every other engine.
 */
export const dagreLayout: LayoutEngine<DagreLayoutOptions> = {
  name: 'dagre',

  async run(graph: LayoutGraph, options?: DagreLayoutOptions, signal?: AbortSignal) {
    await yieldAndCheck(signal, 'dagre')

    const positions = new Map<EntityId, XY>()
    if (graph.nodes.length === 0) return positions

    const inner = new dagre.graphlib.Graph({ directed: true, multigraph: true, compound: false })
    inner.setGraph({
      rankdir: options?.rankdir ?? DEFAULTS.rankdir,
      nodesep: options?.nodesep ?? DEFAULTS.nodesep,
      ranksep: options?.ranksep ?? DEFAULTS.ranksep,
      edgesep: options?.edgesep ?? DEFAULTS.edgesep,
      ranker: options?.ranker ?? DEFAULTS.ranker,
      ...(options?.align ? { align: options.align } : {}),
    })
    inner.setDefaultEdgeLabel(() => ({}))

    for (const node of graph.nodes) {
      inner.setNode(node.id, { width: node.width, height: node.height })
    }

    const known = new Set(graph.nodes.map((node) => node.id))
    for (const edge of graph.edges) {
      if (!known.has(edge.source) || !known.has(edge.target)) continue
      // Naming the edge is what keeps parallel links apart; without it dagre
      // would reduce a bundle to a single edge.
      inner.setEdge(edge.source, edge.target, {}, edge.id)
    }

    dagre.layout(inner)
    await yieldAndCheck(signal, 'dagre')

    for (const node of graph.nodes) {
      const laid = inner.node(node.id)
      if (!laid) continue
      // Dagre reports node centres; the map positions by the top-left corner.
      positions.set(node.id, { x: laid.x - node.width / 2, y: laid.y - node.height / 2 })
    }

    return applyPinned(positions, graph.nodes)
  },
}

export default dagreLayout
