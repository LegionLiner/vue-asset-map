<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, Position, getSmoothStepPath } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetEdgeData } from 'vue-asset-map'

/**
 * An edge that owes nothing to the default one either.
 *
 * Registered through `edgeTypes`. The default draws a bezier; this draws a
 * right-angled run with rounded corners, the way a cabling diagram would, and
 * puts its own chip on the line instead of the package's label.
 */
// Vue Flow hands an edge dozens of props of its own; without this Vue logs an
// "extraneous attributes" warning for every edge on the map.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: Position
  targetPosition?: Position
  markerEnd?: string
  data?: AssetEdgeData
}>()

const map = useMapContext()

const path = computed(() => {
  const [d, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition ?? Position.Bottom,
    targetPosition: props.targetPosition ?? Position.Top,
    borderRadius: 12,
  })
  return { d, labelX, labelY }
})

const link = computed(() => props.data?.link)
const aggregated = computed(() => props.data?.aggregated === true)

/** Colour still comes from `linkTypes`, read through the context. */
const kind = computed(() => map.linkTypeOf(link.value?.type))

const highlighted = computed(() => map.isEdgeHighlighted(props.id))
const dimmed = computed(() => map.isEdgeDimmed(props.id))

const style = computed(() => ({
  stroke: highlighted.value ? '#e0a256' : (kind.value?.color ?? '#8fa0bb'),
  strokeWidth: highlighted.value || aggregated.value ? 3 : 1.6,
  strokeDasharray: kind.value?.dash,
  opacity: dimmed.value ? 0.18 : 1,
  fill: 'none',
}))
</script>

<template>
  <BaseEdge :id="id" :path="path.d" :marker-end="markerEnd" :style="style" />

  <!-- A 1px line is not a click target; this invisible run is what takes the
       pointer, exactly as the package's own edge does. -->
  <path
    :d="path.d"
    class="wired-edge__hit"
    @click="map.onEdgeClick(id, $event)"
    @contextmenu="map.onEdgeContextMenu(id, $event)"
  />

  <EdgeLabelRenderer v-if="!map.simplified.value && (aggregated || link?.type)">
    <div
      class="wired-edge__chip"
      :class="{ 'is-dimmed': dimmed }"
      :style="{
        transform: `translate(-50%, -50%) translate(${path.labelX}px, ${path.labelY}px)`,
        borderColor: kind?.color ?? '#8fa0bb',
        color: kind?.color ?? '#8fa0bb',
      }"
      @click="map.onEdgeClick(id, $event)"
    >
      {{ aggregated ? `×${props.data?.count ?? 1}` : (kind?.label ?? link?.type) }}
    </div>
  </EdgeLabelRenderer>
</template>

<style>
.wired-edge__hit {
  stroke: transparent;
  stroke-width: 16px;
  fill: none;
  cursor: pointer;
  pointer-events: stroke;
}

.wired-edge__chip {
  position: absolute;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 999px;
  background: var(--vp-c-bg);
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.04em;
  cursor: pointer;
  pointer-events: all;
}

.wired-edge__chip.is-dimmed {
  opacity: 0.18;
}
</style>
