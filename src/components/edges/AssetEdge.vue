<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from '@vue-flow/core'
import { useMapContext } from '../../composables/useMapContext'
import type { AssetEdgeData } from '../../composables/useFlowElements'

/**
 * The default map edge.
 *
 * Style (solid, dashed) comes from a class derived from `link.type` rather than
 * an inline `stroke`: colors live in theme tokens, and an edge has to recolor
 * itself when the theme switches.
 */
// VueFlow passes an edge dozens of props of its own (sourceNode, animated,
// labelBgStyle and more), while this template is a fragment of a path and a
// label. Without inheritance off, Vue logs an "extraneous attributes" warning
// for every edge on the map.
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
  const [d, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition ?? Position.Bottom,
    targetPosition: props.targetPosition ?? Position.Top,
  })
  return { d, labelX, labelY }
})

const link = computed(() => props.data?.link)
const aggregated = computed(() => props.data?.aggregated === true)
const count = computed(() => props.data?.count ?? 1)

const highlighted = computed(() => map.isEdgeHighlighted(props.id))

// Dimming is decided by the map: the rule depends on the mode (search or
// selection), and an edge has no business knowing about modes.
const dimmed = computed(() => map.isEdgeDimmed(props.id))
const infected = computed(() => map.isEdgeInfected(props.id))

const classes = computed(() => [
  'vam-edge',
  `vam-edge--type-${link.value?.type ?? 'default'}`,
  {
    'vam-edge--highlighted': highlighted.value,
    'vam-edge--dimmed': dimmed.value,
    'vam-edge--aggregated': aggregated.value,
    'vam-edge--infected': infected.value,
  },
])

const labelSlot = computed(() => map.slot('edge-label'))

// Own label first, then the aggregate count; nothing at all when simplified.
const labelText = computed(() => {
  if (map.simplified.value) return undefined
  if (link.value?.label !== undefined) return link.value.label
  if (aggregated.value) return map.t('link.aggregated', { count: count.value })
  return undefined
})
</script>

<template>
  <BaseEdge :id="id" :path="path.d" :marker-end="markerEnd" :class="classes" />

  <EdgeLabelRenderer v-if="labelText !== undefined || labelSlot">
    <div
      class="vam-edge__label"
      :class="{ 'vam-edge__label--dimmed': dimmed }"
      :style="{ transform: `translate(-50%, -50%) translate(${path.labelX}px, ${path.labelY}px)` }"
      @click="map.onEdgeClick(id, $event)"
    >
      <component :is="labelSlot" v-if="labelSlot" :link="link" :aggregated="aggregated" :count="count" />
      <template v-else>{{ labelText }}</template>
    </div>
  </EdgeLabelRenderer>
</template>

<style>
.vam-edge {
  stroke: var(--vam-edge);
  stroke-width: var(--vam-edge-width);
  fill: none;
  transition:
    stroke var(--vam-transition),
    stroke-width var(--vam-transition),
    opacity var(--vam-transition);
}

.vam-edge--type-dashed {
  stroke: var(--vam-edge-active);
  stroke-dasharray: 6 4;
}

.vam-edge--type-dotted {
  stroke-dasharray: 2 3;
}

.vam-edge--aggregated {
  stroke-width: var(--vam-edge-width-active);
}

.vam-edge--highlighted {
  stroke: var(--vam-edge-active);
  stroke-width: var(--vam-edge-width-active);
}

.vam-edge--dimmed {
  stroke: var(--vam-edge-dimmed);
  opacity: var(--vam-dimmed-opacity);
}

/* An infected link outranks both dimming and path highlighting: capture
   travelled along it. */
.vam-edge--infected,
.vam-edge--infected.vam-edge--dimmed,
.vam-edge--infected.vam-edge--highlighted {
  stroke: var(--vam-infected-edge);
  stroke-width: var(--vam-edge-width-active);
  opacity: 1;
}

.vam-edge__label {
  position: absolute;
  padding: 0 var(--vam-space-1);
  border: 1px solid var(--vam-border);
  border-radius: var(--vam-radius-sm);
  background: var(--vam-edge-label-bg);
  color: var(--vam-fg-muted);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size-sm);
  line-height: 16px;
  pointer-events: all;
  cursor: pointer;
}

.vam-edge__label--dimmed {
  opacity: var(--vam-dimmed-opacity);
}
</style>
