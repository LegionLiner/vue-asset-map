<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDraggableWindow } from '../composables/useDraggableWindow'
import { useTranslate } from '../composables/useTranslate'
import { IconClose, IconCollapseWindow, IconDragHandle } from './icons/index'
import type { XY } from '../types/entity'

/**
 * A floating window over the canvas: title bar, dragging, collapsing, closing.
 *
 * A component of its own rather than part of the details panel, because windows
 * are needed elsewhere too: a consumer builds their own — history, legend, event
 * log — out of it and gets the same bar, the same dragging and the same theme
 * tokens without reimplementing pointer handling.
 *
 * Positioning is the caller's job, through an ordinary `style`: attributes fall
 * through to the root, and the drag `transform` composes with them.
 */
const props = withDefaults(
  defineProps<{
    /** Caption centred in the title bar. */
    title?: string
    /**
     * Show the close button. Pass `false` for windows that must stay, such as a
     * history strip.
     *
     * @default true
     */
    closable?: boolean
    /**
     * Show the button that collapses the window to its title bar.
     *
     * @default true
     */
    collapsible?: boolean
    /**
     * Render the bar only, with no body below it.
     *
     * @default false
     */
    headerOnly?: boolean
    /**
     * Show a drag handle on the left. Needed by windows without a caption.
     *
     * @default false
     */
    dragHandle?: boolean
    /** Starting offset in px; useful to keep windows from stacking exactly. */
    offset?: XY
    /** Button labels. Taken from the locale when omitted. */
    closeLabel?: string
    collapseLabel?: string
    expandLabel?: string
  }>(),
  {
    closable: true,
    collapsible: true,
    headerOnly: false,
    dragHandle: false,
  },
)

const emit = defineEmits<{
  close: []
  'collapse-change': [collapsed: boolean]
}>()

defineSlots<{
  /** Bar content between the buttons. Falls back to `title`. */
  header?(props: { collapsed: boolean }): unknown
  /** Window body. Not rendered when `headerOnly`, nor while collapsed. */
  default?(props: { collapsed: boolean }): unknown
}>()

const t = useTranslate()
const { style, dragging, onPointerDown, reset } = useDraggableWindow(props.offset)

const collapsed = ref(false)

const hasBody = computed(() => !props.headerOnly && !collapsed.value)

const collapseLabel = computed(() => {
  if (collapsed.value) return props.expandLabel ?? t.value('window.expand')
  return props.collapseLabel ?? t.value('window.collapse')
})

function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
  emit('collapse-change', collapsed.value)
}

defineExpose({
  /** Whether the window is collapsed to its bar. */
  collapsed,
  /** Moves the window back to its starting offset. */
  resetPosition: reset,
})
</script>

<template>
  <aside
    class="vnm-window"
    :class="{
      'vnm-window--collapsed': collapsed,
      'vnm-window--dragging': dragging,
      'vnm-window--header-only': headerOnly,
    }"
    :style="style"
  >
    <header class="vnm-window__header" @pointerdown="onPointerDown">
      <span v-if="dragHandle" class="vnm-window__grip" :aria-label="t('window.drag')" role="img">
        <IconDragHandle />
      </span>

      <button
        v-if="closable"
        type="button"
        class="vnm-window__button"
        :aria-label="closeLabel ?? t('window.close')"
        @click="emit('close')"
      >
        <IconClose />
      </button>

      <div class="vnm-window__caption">
        <slot name="header" :collapsed="collapsed">{{ title }}</slot>
      </div>

      <button
        v-if="collapsible"
        type="button"
        class="vnm-window__button"
        :aria-label="collapseLabel"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <IconCollapseWindow :class="{ 'vnm-window__icon--flipped': collapsed }" />
      </button>
    </header>

    <div v-if="hasBody" class="vnm-window__body">
      <slot :collapsed="collapsed" />
    </div>
  </aside>
</template>

<style>
.vnm-window {
  position: absolute;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: var(--vnm-window-width);
  max-width: calc(100% - var(--vnm-space-5));
  max-height: calc(100% - var(--vnm-space-5));
  border-radius: var(--vnm-window-radius);
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-lg);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  line-height: var(--vnm-line-height);
}

/* A bar-only window is sized by its content, not by the shared width token. */
.vnm-window--header-only {
  width: auto;
}

.vnm-window__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vnm-space-2);
  min-height: var(--vnm-window-header-height);
  padding: var(--vnm-space-1);
  border-radius: var(--vnm-window-radius) var(--vnm-window-radius) 0 0;
  background: var(--vnm-surface-sunken);
  cursor: grab;
  /* Otherwise the browser starts its own drag and selects text in the bar. */
  touch-action: none;
  user-select: none;
}

.vnm-window--dragging .vnm-window__header {
  cursor: grabbing;
}

/* Collapsed and bar-only windows are just the bar, so the bottom corners get
   their radius back. */
.vnm-window--collapsed .vnm-window__header,
.vnm-window--header-only .vnm-window__header {
  border-radius: var(--vnm-window-radius);
}

.vnm-window__grip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 2px;
  color: var(--vnm-fg-muted);
}

.vnm-window__caption {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: var(--vnm-space-2);
  min-width: 0;
  overflow: hidden;
  color: var(--vnm-fg-subtle);
  font-size: var(--vnm-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-window__button {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  cursor: pointer;
}

.vnm-window__button:hover {
  color: var(--vnm-fg-subtle);
}

.vnm-window__button:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-window__icon--flipped {
  transform: rotate(180deg);
}

.vnm-window__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vnm-space-4);
  min-height: 0;
  padding: var(--vnm-space-4);
}
</style>
