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

const linkType = computed(() => map.linkTypeOf(link.value?.type))

/**
 * Per-kind stroke, applied inline because the colour is data rather than theme.
 *
 * Withheld while the edge is in a state of its own — highlighted, dimmed or
 * infected — since an inline `stroke` beats every class and would leave those
 * states silently unpainted. In those moments what the edge *is* matters less
 * than what is happening to it.
 */
const typeStyle = computed<Record<string, string> | undefined>(() => {
  if (highlighted.value || dimmed.value || infected.value) return undefined

  const type = linkType.value
  if (!type) return undefined

  const style: Record<string, string> = {}
  if (type.color !== undefined) style.stroke = type.color
  if (type.dash !== undefined) style.strokeDasharray = type.dash
  if (type.width !== undefined) style.strokeWidth = `${type.width}px`
  return Object.keys(style).length > 0 ? style : undefined
})

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
  <BaseEdge :id="id" :path="path.d" :marker-end="markerEnd" :class="classes" :style="typeStyle" />

  <!-- A transparent overlay along the same path, wide enough to actually hit.
       The edge itself is 1px, which is not a click target; without this a right
       click or a plain click would land on the canvas nine times in ten. -->
  <path
    :d="path.d"
    class="vam-edge__hit"
    @click="map.onEdgeClick(id, $event)"
    @contextmenu="map.onEdgeContextMenu(id, $event)"
  />

  <EdgeLabelRenderer v-if="labelText !== undefined || labelSlot">
    <div
      class="vam-edge__label"
      :class="{ 'vam-edge__label--dimmed': dimmed }"
      :style="{ transform: `translate(-50%, -50%) translate(${path.labelX}px, ${path.labelY}px)` }"
      @click="map.onEdgeClick(id, $event)"
      @contextmenu="map.onEdgeContextMenu(id, $event)"
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

/*
 * The click target. Invisible and thick: `stroke: transparent` still takes
 * pointer events with `pointer-events: stroke`, which is what makes a 1px line
 * clickable without drawing anything 16px wide.
 */
.vam-edge__hit {
  stroke: transparent;
  stroke-width: 16px;
  fill: none;
  pointer-events: stroke;
  cursor: pointer;
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
