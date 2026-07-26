<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** One row of the menu. */
export interface ContextMenuItem {
  id: string
  label: string
  /** Draws the row as destructive. */
  danger?: boolean
  disabled?: boolean
}

/**
 * A menu at a point on the canvas, opened by a right click.
 *
 * Positioned in canvas coordinates handed in by the map rather than fixed to the
 * viewport, so it stays put if the page scrolls under it. It flips against the
 * near edge when there is not room, because a menu that opens half off-screen is
 * worse than one that opens on the other side of the cursor.
 */
const props = defineProps<{
  x: number
  y: number
  items: readonly ContextMenuItem[]
  ariaLabel?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
}>()

const element = ref<HTMLElement>()
const flip = ref({ x: false, y: false })

/**
 * Whether the menu would overflow its container, measured after it is in the
 * DOM. Measured rather than guessed: the width depends on the longest label,
 * which is the consumer's text.
 */
function measure(): void {
  const node = element.value
  const parent = node?.offsetParent as HTMLElement | null
  if (!node || !parent) return

  flip.value = {
    x: props.x + node.offsetWidth > parent.clientWidth,
    y: props.y + node.offsetHeight > parent.clientHeight,
  }
}

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  // Shifting by its own size keeps the cursor on the menu's corner either way.
  transform: `translate(${flip.value.x ? '-100%' : '0'}, ${flip.value.y ? '-100%' : '0'})`,
}))

onMounted(() => {
  measure()
  // Capture phase: a click anywhere closes the menu, including one that lands on
  // a node and would otherwise open a second menu before this one had gone.
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
})

watch(() => [props.x, props.y, props.items] as const, measure)

function onDocumentPointerDown(event: PointerEvent): void {
  if (element.value?.contains(event.target as Node)) return
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('close')
}

function onSelect(item: ContextMenuItem): void {
  if (item.disabled === true) return
  emit('select', item.id)
}
</script>

<template>
  <div ref="element" class="vam-menu" role="menu" :aria-label="ariaLabel" :style="style" @contextmenu.prevent>
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      role="menuitem"
      class="vam-menu__item"
      :class="{ 'vam-menu__item--danger': item.danger }"
      :disabled="item.disabled"
      @click="onSelect(item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style>
.vam-menu {
  position: absolute;
  /* Above the windows: a menu opened over one has to be reachable. */
  z-index: 60;
  display: flex;
  flex-direction: column;
  min-width: var(--vam-menu-min-width);
  padding: var(--vam-space-1);
  border: 1px solid var(--vam-window-border);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  box-shadow: var(--vam-shadow-md);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  line-height: var(--vam-line-height);
}

.vam-menu__item {
  display: flex;
  align-items: center;
  padding: var(--vam-space-2) var(--vam-space-3);
  border: 0;
  border-radius: var(--vam-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--vam-transition);
}

.vam-menu__item:hover:not(:disabled) {
  background: var(--vam-accent-soft);
}

.vam-menu__item:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: -2px;
}

.vam-menu__item:disabled {
  color: var(--vam-fg-muted);
  cursor: not-allowed;
}

.vam-menu__item--danger {
  color: var(--vam-menu-danger);
}

.vam-menu__item--danger:hover:not(:disabled) {
  background: var(--vam-menu-danger-soft);
}
</style>
