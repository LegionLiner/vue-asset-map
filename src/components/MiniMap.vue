<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../composables/useTranslate'
import type { XY } from '../types/entity'

/**
 * Обзорная карта.
 *
 * Своя, а не `@vue-flow/minimap`: тот идёт отдельным npm-пакетом со своей
 * палитрой, а требование «ни одного захардкоженного цвета» и «никаких UI-китов»
 * проще выполнить своим SVG на токенах, чем перекрывая чужие стили.
 *
 * Клик перемещает вьюпорт: наружу уходит точка в координатах полотна, а решение
 * о центрировании принимает карта — у неё для этого есть API VueFlow.
 */
export interface MiniMapNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Подсвечивать как совпадение поиска. */
  matched?: boolean
  selected?: boolean
}

const props = defineProps<{
  nodes: MiniMapNode[]
  /** Текущий вьюпорт полотна: сдвиг и масштаб. */
  viewport: { x: number; y: number; zoom: number }
  /** Размер полотна в пикселях. */
  canvas: { width: number; height: number }
  /** Сторона обзорной карты в пикселях. Дефолт 180×120. */
  size?: { width: number; height: number }
}>()

const emit = defineEmits<{ move: [point: XY] }>()

const t = useTranslate()

const box = computed(() => props.size ?? { width: 180, height: 120 })

const PADDING = 24

/** Габариты содержимого плюс запас, чтобы узлы не липли к рамке. */
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

  // Вьюпорт тоже входит в габариты: иначе, уехав мышью в пустоту, пользователь
  // теряет рамку вьюпорта с обзорной карты и не понимает, куда смотрит.
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

/** Прямоугольник вьюпорта в координатах полотна. */
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

/** Толщина обводки в координатах полотна: на глаз должна быть постоянной. */
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
