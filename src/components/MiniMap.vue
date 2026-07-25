<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../composables/useTranslate'
import type { XY } from '../types/entity'

/**
 * Overview map.
 *
 * Home-grown rather than `@vue-flow/minimap`: that one is a separate npm package
 * with a palette of its own, and "no hardcoded colors, no UI kits" is easier to
 * satisfy with a token-driven SVG than by overriding someone else's styles.
 *
 * A click emits a point in canvas coordinates; centring on it is the map's
 * decision, since the map is the one holding VueFlow's API.
 */
/** One node as drawn on the overview; all coordinates are canvas px. */
export interface MiniMapNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Draw as a search hit. */
  matched?: boolean
  selected?: boolean
}

const props = defineProps<{
  nodes: MiniMapNode[]
  /** Current canvas viewport: pan offset in px plus zoom factor. */
  viewport: { x: number; y: number; zoom: number }
  /** Canvas size in px. */
  canvas: { width: number; height: number }
  /**
   * Overview size in px.
   *
   * @default 180×120
   */
  size?: { width: number; height: number }
}>()

const emit = defineEmits<{ move: [point: XY] }>()

const t = useTranslate()

const box = computed(() => props.size ?? { width: 180, height: 120 })

const PADDING = 24

/** Content bounds plus padding, so nodes do not touch the frame. */
const bounds = computed(() => {
  if (props.nodes.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of props.nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  // The viewport is part of the bounds: pan off into empty space and otherwise
  // its rectangle leaves the overview, stranding the user with no reference.
  const view = viewportRect.value
  minX = Math.min(minX, view.x)
  minY = Math.min(minY, view.y)
  maxX = Math.max(maxX, view.x + view.width)
  maxY = Math.max(maxY, view.y + view.height)

  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: Math.max(1, maxX - minX + PADDING * 2),
    height: Math.max(1, maxY - minY + PADDING * 2),
  }
})

/** The viewport rectangle, converted from screen px to canvas coordinates. */
const viewportRect = computed(() => {
  const zoom = props.viewport.zoom === 0 ? 1 : props.viewport.zoom
  return {
    x: -props.viewport.x / zoom,
    y: -props.viewport.y / zoom,
    width: props.canvas.width / zoom,
    height: props.canvas.height / zoom,
  }
})

const viewBox = computed(() => {
  const { x, y, width, height } = bounds.value
  return `${x} ${y} ${width} ${height}`
})

// Stroke width is expressed in canvas units so it looks constant on screen
// whatever the overview scale works out to be.
const strokeWidth = computed(() => bounds.value.width / box.value.width)

function onClick(event: MouseEvent): void {
  const target = event.currentTarget
  if (!(target instanceof Element)) return

  const rect = target.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const { x, y, width, height } = bounds.value
  emit('move', {
    x: x + ((event.clientX - rect.left) / rect.width) * width,
    y: y + ((event.clientY - rect.top) / rect.height) * height,
  })
}
</script>

<template>
  <svg
    class="vnm-minimap"
    :width="box.width"
    :height="box.height"
    :viewBox="viewBox"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="t('minimap.label')"
    @click="onClick"
  >
    <rect
      v-for="node in nodes"
      :key="node.id"
      class="vnm-minimap__node"
      :class="{
        'vnm-minimap__node--matched': node.matched === true,
        'vnm-minimap__node--selected': node.selected === true,
      }"
      :x="node.x"
      :y="node.y"
      :width="node.width"
      :height="node.height"
    />

    <rect
      class="vnm-minimap__viewport"
      :x="viewportRect.x"
      :y="viewportRect.y"
      :width="viewportRect.width"
      :height="viewportRect.height"
      :stroke-width="strokeWidth * 2"
    />
  </svg>
</template>

<style>
.vnm-minimap {
  position: absolute;
  right: var(--vnm-space-3);
  bottom: var(--vnm-space-3);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-md);
  cursor: pointer;
}

.vnm-minimap__node {
  fill: var(--vnm-fg-muted);
  opacity: 0.6;
}

.vnm-minimap__node--matched {
  fill: var(--vnm-highlight);
  opacity: 1;
}

.vnm-minimap__node--selected {
  fill: var(--vnm-accent);
  opacity: 1;
}

.vnm-minimap__viewport {
  fill: var(--vnm-accent-soft);
  stroke: var(--vnm-accent);
}
</style>
