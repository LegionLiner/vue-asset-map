<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * A `<canvas>` over the map, for when nodes are too small to be worth a DOM
 * element each.
 *
 * Zoomed out past the LOD threshold on a large map, the viewport covers most of
 * it, and culling has nothing left to cull: every node would be mounted just to
 * show a dot. Here the map draws dots and lines instead, in one element.
 *
 * The component owns the surface — device pixel ratio, size, the viewport
 * transform, one paint per animation frame — and the map owns what is drawn:
 * `paint` receives a context already in canvas coordinates, plus a resolver for
 * theme tokens so colours keep coming from `--vam-*` rather than from code.
 */
const props = defineProps<{
  /** Current canvas viewport: pan offset in px plus zoom factor. */
  viewport: { x: number; y: number; zoom: number }
  /** Size of the area to cover, in screen px. */
  size: { width: number; height: number }
  /** Anything that changes what is drawn; a new value repaints. */
  revision: unknown
  paint: (context: CanvasRenderingContext2D, token: (name: string) => string) => void
}>()

const element = ref<HTMLCanvasElement>()

let cancelFrame: (() => void) | undefined
let tokens = new Map<string, string>()

/**
 * Resolved once per paint, not once per node: `getComputedStyle` is slow to
 * call, and a theme does not change halfway through a frame.
 */
function tokenResolver(): (name: string) => string {
  const canvas = element.value
  const style = canvas ? getComputedStyle(canvas) : undefined
  tokens = new Map()
  return (name) => {
    let value = tokens.get(name)
    if (value === undefined) {
      value = style?.getPropertyValue(name).trim() ?? ''
      tokens.set(name, value)
    }
    return value
  }
}

function draw(): void {
  cancelFrame = undefined
  const canvas = element.value
  if (!canvas) return
  const context = canvas.getContext('2d')
  if (!context) return

  const ratio = globalThis.devicePixelRatio || 1
  const width = Math.max(1, Math.round(props.size.width * ratio))
  const height = Math.max(1, Math.round(props.size.height * ratio))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, width, height)

  const zoom = props.viewport.zoom > 0 ? props.viewport.zoom : 1
  context.setTransform(ratio * zoom, 0, 0, ratio * zoom, ratio * props.viewport.x, ratio * props.viewport.y)
  props.paint(context, tokenResolver())
}

// Panning fires many viewport updates per frame; they collapse into one paint.
function schedule(): void {
  if (cancelFrame !== undefined) return
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(draw)
    cancelFrame = () => cancelAnimationFrame(id)
    return
  }
  const id = setTimeout(draw, 16)
  cancelFrame = () => clearTimeout(id)
}

watch([() => props.viewport, () => props.size, () => props.revision, () => props.paint], schedule)
onMounted(schedule)
onBeforeUnmount(() => cancelFrame?.())
</script>

<template>
  <canvas
    ref="element"
    class="vam-lod-canvas"
    :style="{ width: `${size.width}px`, height: `${size.height}px` }"
    aria-hidden="true"
  />
</template>

<style>
/* Under the toolbar and the windows, over VueFlow's empty pane. The pointer goes
   through to the pane, so panning and zooming keep working as before. */
.vam-lod-canvas {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  pointer-events: none;
}
</style>
