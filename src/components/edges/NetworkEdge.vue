<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from '@vue-flow/core'
import { useMapContext } from '../../composables/useMapContext'
import type { NetworkEdgeData } from '../../composables/useFlowElements'

/**
 * Ребро карты.
 *
 * Стиль (сплошное, пунктирное) задаётся классом по `link.kind`, а не инлайновым
 * `stroke`: цвета живут в токенах темы, и при переключении темы ребро должно
 * менять цвет само.
 */
// VueFlow передаёт ребру десятки собственных атрибутов (sourceNode, animated,
// labelBgStyle и прочие), а шаблон здесь — фрагмент из пути и подписи. Без
// отключённого наследования Vue на каждое ребро пишет в консоль предупреждение
// о «лишних» атрибутах, которые ребру и не нужны.
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
  data?: NetworkEdgeData
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

const dimmed = computed(() => {
  const current = link.value
  if (!current) return false
  // Ребро гаснет вместе с обоими своими концами: если хоть один конец в
  // результатах поиска, связь остаётся заметной.
  return map.isDimmed(current.source) && map.isDimmed(current.target)
})

const classes = computed(() => [
  'vnm-edge',
  `vnm-edge--kind-${link.value?.kind ?? 'default'}`,
  {
    'vnm-edge--highlighted': highlighted.value,
    'vnm-edge--dimmed': dimmed.value,
    'vnm-edge--aggregated': aggregated.value,
  },
])

const labelSlot = computed(() => map.slots['edge-label'])

/** Подпись показывается только там, где она несёт смысл. */
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
      class="vnm-edge__label"
      :class="{ 'vnm-edge__label--dimmed': dimmed }"
      :style="{ transform: `translate(-50%, -50%) translate(${path.labelX}px, ${path.labelY}px)` }"
      @click="map.onEdgeClick(id, $event)"
    >
      <component :is="labelSlot" v-if="labelSlot" :link="link" :aggregated="aggregated" :count="count" />
      <template v-else>{{ labelText }}</template>
    </div>
  </EdgeLabelRenderer>
</template>

<style>
.vnm-edge {
  stroke: var(--vnm-edge);
  stroke-width: var(--vnm-edge-width);
  fill: none;
  transition:
    stroke var(--vnm-transition),
    stroke-width var(--vnm-transition),
    opacity var(--vnm-transition);
}

.vnm-edge--kind-dashed {
  stroke: var(--vnm-edge-active);
  stroke-dasharray: 6 4;
}

.vnm-edge--kind-dotted {
  stroke-dasharray: 2 3;
}

.vnm-edge--aggregated {
  stroke-width: var(--vnm-edge-width-active);
}

.vnm-edge--highlighted {
  stroke: var(--vnm-edge-active);
  stroke-width: var(--vnm-edge-width-active);
}

.vnm-edge--dimmed {
  stroke: var(--vnm-edge-dimmed);
  opacity: var(--vnm-dimmed-opacity);
}

.vnm-edge__label {
  position: absolute;
  padding: 0 var(--vnm-space-1);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-edge-label-bg);
  color: var(--vnm-fg-muted);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size-sm);
  line-height: 16px;
  pointer-events: all;
  cursor: pointer;
}

.vnm-edge__label--dimmed {
  opacity: var(--vnm-dimmed-opacity);
}
</style>
