import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { SpatialIndex, unionRect, type Rect } from '../core/spatial'
import type { EntityId, XY } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { CollapseResult } from '../types/collapse'
import type { NodeSize } from './useLayout'

/** Parameters of {@link useVirtualization}. */
export interface UseVirtualizationParams<E, L> {
  /** Whether culling is on; the index is not even built while it is off. */
  enabled: Ref<boolean>
  graph: ComputedRef<AssetGraph<E, L>>
  /** The collapsed graph as of its last structural change. */
  topology: ComputedRef<CollapseResult<unknown>>
  /** Engine output; a new map means a new layout. */
  layoutPositions: Ref<ReadonlyMap<EntityId, XY>>
  /** Hand-placed positions, diffed so a drag moves one node in the index. */
  manual: Ref<Record<EntityId, XY>>
  positionOf: (id: string) => XY | undefined
  sizeOf: (id: string) => NodeSize
  viewport: Ref<{ x: number; y: number; zoom: number }>
  /** Canvas size in screen px; zero while unmeasured. */
  canvas: Ref<{ width: number; height: number }>
  /**
   * Extra room around the screen, as a fraction of its size on each side.
   *
   * @default 0.5
   */
  margin?: number
}

/** What is near the viewport right now. */
export interface VisibleSet {
  nodeIds: readonly string[]
  edgeIds: readonly string[]
}

/** Return value of {@link useVirtualization}. */
export interface UseVirtualizationReturn {
  /** Nodes and edges to mount: those near the viewport, plus the far ends of their edges. */
  visible: ComputedRef<VisibleSet>
  /**
   * Nodes and edges strictly inside the viewport, with no margin and no far ends
   * — what a canvas draw has to cover.
   */
  onScreen: () => VisibleSet
  /** Every node's extent, for a fit that does not depend on what is mounted. */
  bounds: () => Rect | undefined
  /** The node under a canvas point. */
  hitTest: (point: XY, tolerance?: number) => string | undefined
  /** Bumped whenever the index changes, for anything drawn from it. */
  version: Ref<number>
  /** Rectangle of a node in the index, in canvas px. */
  rectOf: (id: string) => Rect | undefined
  /** Ends of an edge of the collapsed graph. */
  endsOf: (edgeId: string) => readonly [string, string] | undefined
}

const DEFAULT_MARGIN = 0.5
const CELL_SIZE = 512

/** Used while the canvas has not been measured yet: about a laptop screen. */
const FALLBACK_CANVAS = { width: 1280, height: 800 }

/**
 * Viewport culling the map does itself, from sizes it already knows.
 *
 * VueFlow's `onlyRenderVisibleElements` cannot do this job on a large map: it
 * asks every node for its measured size, and a node that has not been measured
 * yet is 0×0 — which its overlap check reads as "inside". So the first frame
 * mounted every node, each with its own `ResizeObserver`, and expanding a group
 * did it again. On top of that VueFlow walks all nodes and edges on every pan.
 *
 * Node sizes are known before anything renders (`sizeOf`), and positions come
 * from the layout, so a spatial index answers "what is on screen" without the
 * DOM. Only that, plus a margin, goes to VueFlow; the rest is never mounted.
 *
 * An edge is mounted when its bounding box crosses the area, and both of its
 * ends with it — VueFlow cannot draw an edge whose node it does not have. So a
 * long edge passing through the screen is drawn even when neither end is near.
 */
export function useVirtualization<E, L>(params: UseVirtualizationParams<E, L>): UseVirtualizationReturn {
  const { enabled, graph, topology, layoutPositions, manual, positionOf, sizeOf, viewport, canvas } = params
  const margin = params.margin ?? DEFAULT_MARGIN

  const nodeIndex = new SpatialIndex({ cellSize: CELL_SIZE })
  const edgeIndex = new SpatialIndex({ cellSize: CELL_SIZE })
  /** Edge ids by node, to move a node's edges along with it. */
  const incident = new Map<string, string[]>()
  const ends = new Map<string, readonly [string, string]>()
  const version = ref(0)

  const rectFor = (id: string): Rect | undefined => {
    const position = positionOf(id)
    if (!position) return undefined
    const size = sizeOf(id)
    return { x: position.x, y: position.y, width: size.width, height: size.height }
  }

  const placeEdge = (edgeId: string): void => {
    const pair = ends.get(edgeId)
    if (!pair) return
    const source = nodeIndex.get(pair[0])
    const target = nodeIndex.get(pair[1])
    if (source && target) edgeIndex.set(edgeId, unionRect(source, target))
    else edgeIndex.delete(edgeId)
  }

  function rebuild(): void {
    nodeIndex.clear()
    edgeIndex.clear()
    incident.clear()
    ends.clear()

    if (enabled.value) {
      const current = topology.value
      for (const id of current.nodeIds) {
        const rect = rectFor(id)
        if (rect) nodeIndex.set(id, rect)
      }
      for (const link of current.links) {
        ends.set(link.id, [link.source, link.target])
        pushTo(incident, link.source, link.id)
        if (link.target !== link.source) pushTo(incident, link.target, link.id)
        placeEdge(link.id)
      }
    }

    version.value += 1
  }

  /** Re-reads the positions of these nodes and moves whichever changed. */
  function sync(ids: Iterable<string>): void {
    if (!enabled.value) return
    let changed = false

    const known = topologyIds()
    for (const id of ids) {
      // A manual position may belong to an entity folded into a group: it is
      // not a node of the map and has no place in the index.
      if (!known.has(id)) continue

      const rect = rectFor(id)
      const previous = nodeIndex.get(id)
      if (!rect) {
        if (nodeIndex.delete(id)) changed = true
      } else if (
        !previous ||
        previous.x !== rect.x ||
        previous.y !== rect.y ||
        previous.width !== rect.width ||
        previous.height !== rect.height
      ) {
        nodeIndex.set(id, rect)
        changed = true
      } else {
        continue
      }

      for (const edgeId of incident.get(id) ?? []) placeEdge(edgeId)
    }

    if (changed) version.value += 1
  }

  let idSet: { topology: CollapseResult<unknown>; ids: Set<string> } | undefined
  const topologyIds = (): Set<string> => {
    const current = topology.value
    if (idSet?.topology !== current) idSet = { topology: current, ids: new Set(current.nodeIds) }
    return idSet.ids
  }

  // Synchronous: the index has to agree with the sources before anything reads
  // it in the same tick, or a frame would cull against the previous layout.
  watch([enabled, topology, layoutPositions], rebuild, { immediate: true, flush: 'sync' })

  // A drag replaces the manual object with one changed key; comparing entries
  // finds it without rebuilding anything.
  watch(
    manual,
    (next, previous) => {
      if (!enabled.value) return
      const changed: string[] = []
      for (const id of Object.keys(next)) {
        const a = next[id]
        const b = previous?.[id]
        if (a !== b && (a?.x !== b?.x || a?.y !== b?.y)) changed.push(id)
      }
      for (const id of Object.keys(previous ?? {})) {
        if (!(id in next)) changed.push(id)
      }
      sync(changed)
    },
    { flush: 'sync' },
  )

  // New records may carry new `position`s without the structure changing.
  watch(graph, () => sync(topology.value.nodeIds), { flush: 'sync' })

  /** The viewport in canvas px, grown by `grow` of its size on each side. */
  const viewArea = (grow: number): Rect => {
    const { x, y, zoom } = viewport.value
    const scale = zoom > 0 ? zoom : 1
    const size = canvas.value.width > 0 && canvas.value.height > 0 ? canvas.value : FALLBACK_CANVAS
    const width = size.width / scale
    const height = size.height / scale
    return {
      x: -x / scale - width * grow,
      y: -y / scale - height * grow,
      width: width * (1 + grow * 2),
      height: height * (1 + grow * 2),
    }
  }

  let last: { key: string; version: number; set: VisibleSet } | undefined
  let rank: { order: readonly string[]; of: Map<string, number> } | undefined

  const visible = computed<VisibleSet>(() => {
    const currentVersion = version.value
    const area = viewArea(margin)

    // Snapped outwards to whole cells: small pans then land on the same area,
    // the same answer and the same object — and nothing downstream re-runs.
    const x0 = Math.floor(area.x / CELL_SIZE)
    const y0 = Math.floor(area.y / CELL_SIZE)
    const x1 = Math.ceil((area.x + area.width) / CELL_SIZE)
    const y1 = Math.ceil((area.y + area.height) / CELL_SIZE)
    const key = `${x0},${y0},${x1},${y1}`
    if (last && last.key === key && last.version === currentVersion) return last.set

    const snapped: Rect = {
      x: x0 * CELL_SIZE,
      y: y0 * CELL_SIZE,
      width: (x1 - x0) * CELL_SIZE,
      height: (y1 - y0) * CELL_SIZE,
    }

    const edgeIds = edgeIndex.search(snapped)
    const nodes = new Set(nodeIndex.search(snapped))
    for (const edgeId of edgeIds) {
      const pair = ends.get(edgeId)
      if (!pair) continue
      nodes.add(pair[0])
      nodes.add(pair[1])
    }

    // Kept in topology order, so VueFlow stacks nodes the same way whatever
    // order the grid cells happened to return them in.
    const order = topology.value.nodeIds
    if (rank?.order !== order) rank = { order, of: new Map(order.map((id, index) => [id, index])) }
    const ranks = rank.of
    const nodeIds = [...nodes].sort((a, b) => (ranks.get(a) ?? 0) - (ranks.get(b) ?? 0))
    const set: VisibleSet = { nodeIds, edgeIds }

    const previous = last?.set
    const unchanged =
      previous !== undefined &&
      sameIds(previous.nodeIds, set.nodeIds) &&
      sameIds(previous.edgeIds, set.edgeIds)
    const result = unchanged && previous ? previous : set
    last = { key, version: currentVersion, set: result }
    return result
  })

  const onScreen = (): VisibleSet => {
    const area = viewArea(0)
    return { nodeIds: nodeIndex.search(area), edgeIds: edgeIndex.search(area) }
  }

  return {
    visible,
    onScreen,
    bounds: () => nodeIndex.bounds(),
    hitTest: (point, tolerance) => nodeIndex.hitTest(point, tolerance),
    version,
    rectOf: (id) => nodeIndex.get(id),
    endsOf: (edgeId) => ends.get(edgeId),
  }
}

function pushTo(index: Map<string, string[]>, key: string, value: string): void {
  const bucket = index.get(key)
  if (bucket) bucket.push(value)
  else index.set(key, [value])
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}
