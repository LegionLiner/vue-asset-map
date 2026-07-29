import { computed, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { EntityId, XY } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { CollapseResult } from '../types/collapse'
import type { AssetView } from '../types/view'
import type { AssetMapLayoutSpec } from '../types/props'
import { isLayoutAborted, type LayoutEngine, type LayoutGraph, type LayoutNode } from '../layout/types'
import { resolveLayoutEngine } from '../layout/index'
import { manualLayout } from '../layout/manual'

/** Rendered size of a node in canvas px, measured before layout runs. */
export interface NodeSize {
  width: number
  height: number
}

/** Parameters of {@link useLayout}. */
export interface UseLayoutParams<E, L> {
  graph: ComputedRef<AssetGraph<E, L>>
  collapsed: ComputedRef<CollapseResult<unknown>>
  /** Layout from props; outranks the view's own layout. */
  spec: Ref<AssetMapLayoutSpec | undefined>
  view: ComputedRef<AssetView | undefined>
  /** Extra engines registered by the consumer, addressable by name. */
  engines?: Ref<Readonly<Record<string, LayoutEngine>> | undefined>
  /**
   * Positions the user moved by hand, owned by the caller so they can outlive
   * the component.
   *
   * A plain object rather than a `Map`: this is the thing an application saves,
   * and `JSON.stringify` turns a `Map` into `{}`. Omitted, the composable keeps
   * its own and the moves are forgotten on unmount.
   */
  manual?: Ref<Record<EntityId, XY>>
  sizeOf: (nodeId: string) => NodeSize
  onStart?: (engineName: string) => void
  onDone?: (engineName: string, positionCount: number) => void
  onError?: (error: unknown) => void
}

/** Return value of {@link useLayout}. */
export interface UseLayoutReturn {
  /** Latest engine output. Replaced wholesale, never mutated in place. */
  positions: Ref<ReadonlyMap<EntityId, XY>>
  running: Ref<boolean>
  engineName: ComputedRef<string>
  relayout: () => Promise<void>
  /** Records a position produced by dragging a node. */
  setManualPosition: (id: EntityId, position: XY) => void
  clearManualPositions: () => void
  /** Final position of a node, priorities applied. */
  positionOf: (id: string) => XY | undefined
  /**
   * Every node's current position, priorities applied.
   *
   * The whole picture, engine output included — what a snapshot needs, as
   * opposed to `manual`, which is only what someone moved on purpose.
   */
  snapshot: (ids: Iterable<string>) => Record<EntityId, XY>
}

/**
 * Runs the layout engine and applies its result.
 *
 * Position priority: dragged by hand → `entity.position` from the backend →
 * engine output. The first two are handed to the engine as `pinned`, so the
 * engine leaves them alone rather than moving them and being corrected after.
 *
 * Every run aborts the previous one through `AbortSignal`: switch views three
 * times quickly and only the last layout is applied. The result lands as a
 * single `Map` assignment — one reactive trigger per layout, not per node.
 *
 * Layout deliberately ignores the filter: search hides and highlights nodes but
 * never rebuilds the map, or the graph would jump on every keystroke.
 */
export function useLayout<E, L>(params: UseLayoutParams<E, L>): UseLayoutReturn {
  const { graph, collapsed, spec, view, engines, sizeOf, onStart, onDone, onError } = params

  const positions = shallowRef<ReadonlyMap<EntityId, XY>>(new Map())
  // Falls back to a ref of its own, so the composable still works standalone —
  // the moves are simply forgotten when it goes away.
  const manual = params.manual ?? ref<Record<EntityId, XY>>({})
  const running = ref(false)

  let controller: AbortController | undefined

  // Props outrank the view: props sit closer to the consumer.
  const activeSpec = computed<AssetMapLayoutSpec | undefined>(() => spec.value ?? view.value?.layout)

  const engine = computed<LayoutEngine>(() => {
    const requested = activeSpec.value?.engine
    const resolved = resolveLayoutEngine(requested, engines?.value)
    if (resolved) return resolved
    if (typeof requested === 'string') {
      // Engine names arrive from view data, i.e. from outside. A typo must not
      // blank the map — fall back to manual and report it.
      onError?.(new Error(`Unknown layout engine "${requested}", falling back to "manual"`))
    }
    return manualLayout
  })

  const engineName = computed(() => engine.value.name)

  const pinnedOf = (id: string): XY | undefined =>
    manual.value[id] ?? graph.value.entities.get(id)?.position

  function buildLayoutGraph(): LayoutGraph {
    const nodes: LayoutNode[] = collapsed.value.nodeIds.map((id) => {
      const size = sizeOf(id)
      const pinned = pinnedOf(id)
      return { id, width: size.width, height: size.height, ...(pinned ? { pinned } : {}) }
    })

    return {
      nodes,
      edges: collapsed.value.links.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
      })),
    }
  }

  async function relayout(): Promise<void> {
    controller?.abort()
    const current = new AbortController()
    controller = current

    const active = engine.value
    running.value = true
    onStart?.(active.name)

    try {
      const result = await active.run(buildLayoutGraph(), activeSpec.value?.options, current.signal)

      // A newer run may have started while this one was computing. Checked here
      // as well as inside the engine, because a third-party engine may ignore
      // the signal entirely.
      if (current.signal.aborted || controller !== current) return

      positions.value = result
      onDone?.(active.name, result.size)
    } catch (error) {
      if (isLayoutAborted(error)) return
      onError?.(error)
    } finally {
      if (controller === current) {
        running.value = false
        controller = undefined
      }
    }
  }

  // `collapsed` is a fresh object on every recomputation, which makes it a
  // sufficient "the graph changed" signal on its own.
  watch([collapsed, engine, activeSpec], () => void relayout(), { immediate: true })

  // Always a new object: `manual` may be a `v-model` the consumer owns, where
  // editing in place would raise no update and would mutate their state.
  const setManualPosition = (id: EntityId, position: XY): void => {
    manual.value = { ...manual.value, [id]: { x: position.x, y: position.y } }
  }

  const clearManualPositions = (): void => {
    if (Object.keys(manual.value).length === 0) return
    manual.value = {}
  }

  // Same priority order as the one handed to the engine, so a node does not
  // jump between "before" and "after" the result is applied.
  const positionOf = (id: string): XY | undefined =>
    manual.value[id] ?? graph.value.entities.get(id)?.position ?? positions.value.get(id)

  const snapshot = (ids: Iterable<string>): Record<EntityId, XY> => {
    const result: Record<EntityId, XY> = {}
    for (const id of ids) {
      const position = positionOf(id)
      // Copied, not handed out by reference: a caller storing the snapshot must
      // not end up holding the map's own coordinates.
      if (position) result[id] = { x: position.x, y: position.y }
    }
    return result
  }

  onScopeDispose(() => controller?.abort())

  return {
    positions,
    running,
    engineName,
    relayout,
    setManualPosition,
    clearManualPositions,
    positionOf,
    snapshot,
  }
}
