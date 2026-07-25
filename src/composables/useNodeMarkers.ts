import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import type { EntityId, AssetEntity } from '../types/entity'
import type { AssetGraph } from '../types/graph'
import type { NodeMarkerDef, ResolvedNodeMarker } from '../types/marker'

/** Return value of {@link useNodeMarkers}. */
export interface UseNodeMarkersReturn {
  /** Markers of an entity, in declaration order. */
  markersFor: (id: EntityId) => readonly ResolvedNodeMarker[]
  /** Marker currently hovered, once the delay has elapsed. */
  hoveredMarker: Ref<string | undefined>
  /** Entities carrying the hovered marker; empty while nothing is hovered. */
  memberIds: ComputedRef<ReadonlySet<EntityId>>
  /** Pointer entered a dot: highlighting starts after the delay. */
  onMarkerEnter: (markerId: string) => void
  /** Pointer left: cancels both the pending delay and active highlighting. */
  onMarkerLeave: () => void
  /** Highlights immediately, for keyboard focus. */
  onMarkerFocus: (markerId: string) => void
}

const DEFAULT_HOVER_DELAY_MS = 500

/** Colors are handed out by declaration order and wrap around when exhausted. */
const PALETTE = ['var(--vam-marker-1)', 'var(--vam-marker-2)', 'var(--vam-marker-3)'] as const

/**
 * Membership markers for nodes, plus the hover highlighting they drive.
 *
 * The entity → markers index is computed once per data change; otherwise every
 * node would run every `match` predicate on every render.
 *
 * The delay before highlighting keeps a pointer that merely crosses the dots on
 * its way elsewhere from flashing the whole map. Leaving cancels both the
 * pending delay and highlighting that already started.
 */
export function useNodeMarkers<E, L>(
  graph: Ref<AssetGraph<E, L>> | ComputedRef<AssetGraph<E, L>>,
  markers: Ref<NodeMarkerDef[] | undefined>,
  hoverDelay: Ref<number | undefined>,
): UseNodeMarkersReturn {
  // Palette index depends on declaration order alone, so a marker keeps its
  // color no matter which nodes carry it.
  const resolved = computed<ResolvedNodeMarker[]>(() =>
    (markers.value ?? []).map((marker, index) => ({
      id: marker.id,
      // Cast: the modulo keeps the index in range, which `noUncheckedIndexedAccess`
      // cannot see.
      color: marker.color ?? (PALETTE[index % PALETTE.length] as string),
      label: marker.label ?? marker.id,
    })),
  )

  /**
   * Entity → its markers.
   *
   * Iterates markers rather than entities: a marker with `members` computes its
   * set in one pass over the graph, while a `match` predicate would have to run
   * entities × markers times. Dot order on a node is marker declaration order,
   * because that is what the outer loop follows.
   */
  const byEntity = computed(() => {
    const index = new Map<EntityId, ResolvedNodeMarker[]>()
    const defs = markers.value
    if (!defs || defs.length === 0) return index

    const attach = (entityId: EntityId, marker: ResolvedNodeMarker): void => {
      const own = index.get(entityId)
      if (own) own.push(marker)
      else index.set(entityId, [marker])
    }

    defs.forEach((def, position) => {
      const marker = resolved.value[position]
      if (!marker) return

      if (def.members) {
        for (const entityId of def.members(graph.value)) {
          // A marker may name a node that is no longer in the data.
          if (graph.value.entities.has(entityId)) attach(entityId, marker)
        }
        return
      }

      const match = def.match
      if (!match) return
      for (const entity of graph.value.entities.values()) {
        // Cast: `match` is declared over `AssetEntity<unknown>`, and `meta` is
        // only read by the consumer's own predicate.
        if (match(entity as AssetEntity, graph.value)) attach(entity.id, marker)
      }
    })

    return index
  })

  const hoveredMarker = ref<string | undefined>(undefined)

  const memberIds = computed<ReadonlySet<EntityId>>(() => {
    const markerId = hoveredMarker.value
    if (markerId === undefined) return new Set()

    const members = new Set<EntityId>()
    for (const [entityId, own] of byEntity.value) {
      if (own.some((marker) => marker.id === markerId)) members.add(entityId)
    }
    return members
  })

  let timer: ReturnType<typeof setTimeout> | undefined

  const clearTimer = (): void => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const onMarkerEnter = (markerId: string): void => {
    clearTimer()
    const delay = hoverDelay.value ?? DEFAULT_HOVER_DELAY_MS
    if (delay <= 0) {
      hoveredMarker.value = markerId
      return
    }
    timer = setTimeout(() => {
      hoveredMarker.value = markerId
      timer = undefined
    }, delay)
  }

  const onMarkerLeave = (): void => {
    clearTimer()
    hoveredMarker.value = undefined
  }

  // Nothing to wait for on the keyboard: focus is already a deliberate act.
  const onMarkerFocus = (markerId: string): void => {
    clearTimer()
    hoveredMarker.value = markerId
  }

  onScopeDispose(clearTimer)

  return {
    markersFor: (id) => byEntity.value.get(id) ?? [],
    hoveredMarker,
    memberIds,
    onMarkerEnter,
    onMarkerLeave,
    onMarkerFocus,
  }
}
