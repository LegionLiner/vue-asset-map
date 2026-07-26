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
    class="vam-window"
    :class="{
      'vam-window--collapsed': collapsed,
      'vam-window--dragging': dragging,
      'vam-window--header-only': headerOnly,
    }"
    :style="style"
  >
    <header class="vam-window__header" @pointerdown="onPointerDown">
      <span v-if="dragHandle" class="vam-window__grip" :aria-label="t('window.drag')" role="img">
        <IconDragHandle />
      </span>

      <button
        v-if="closable"
        type="button"
        class="vam-window__button"
        :aria-label="closeLabel ?? t('window.close')"
        @click="emit('close')"
      >
        <IconClose />
      </button>

      <div class="vam-window__caption">
        <slot name="header" :collapsed="collapsed">{{ title }}</slot>
      </div>

      <button
        v-if="collapsible"
        type="button"
        class="vam-window__button"
        :aria-label="collapseLabel"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <IconCollapseWindow :class="{ 'vam-window__icon--flipped': collapsed }" />
      </button>
    </header>

    <div v-if="hasBody" class="vam-window__body">
      <slot :collapsed="collapsed" />
    </div>
  </aside>
</template>

<style>
.vam-window {
  position: absolute;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: var(--vam-window-width);
  max-width: calc(100% - var(--vam-space-5));
  max-height: calc(100% - var(--vam-space-5));
  border: 1px solid var(--vam-window-border);
  border-radius: var(--vam-window-radius);
  background: var(--vam-surface);
  box-shadow: var(--vam-window-shadow);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  line-height: var(--vam-line-height);
}

/*
 * A window with nothing under its bar is sized by that bar's contents rather
 * than by the shared width token — a caption of three words has no business
 * holding a 480px box open. `max-content` over `auto` because the bar is a flex
 * row: `auto` would let the caption wrap instead of setting the width.
 */
.vam-window--header-only,
.vam-window--collapsed {
  width: max-content;
  max-width: calc(100% - var(--vam-space-5));
}

.vam-window__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vam-space-2);
  min-height: var(--vam-window-header-height);
  padding: var(--vam-space-1);
  border-radius: var(--vam-window-radius) var(--vam-window-radius) 0 0;
  background: var(--vam-surface-sunken);
  cursor: grab;
  /* Otherwise the browser starts its own drag and selects text in the bar. */
  touch-action: none;
  user-select: none;
}

.vam-window--dragging .vam-window__header {
  cursor: grabbing;
}

/* Collapsed and bar-only windows are just the bar, so the bottom corners get
   their radius back. */
.vam-window--collapsed .vam-window__header,
.vam-window--header-only .vam-window__header {
  border-radius: var(--vam-window-radius);
}

.vam-window__grip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 2px;
  color: var(--vam-fg-muted);
}

.vam-window__caption {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: var(--vam-space-2);
  min-width: 0;
  /* Breathing room either side, so a caption sized by its own text does not end
     up touching the buttons once the window is collapsed. */
  padding: 0 var(--vam-window-caption-padding);
  overflow: hidden;
  color: var(--vam-fg-subtle);
  font-size: var(--vam-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * The buttons are 16px of icon, which is a small target and an easy one to
 * doubt having hit. A plate on hover and a pressed state on `:active` say the
 * click landed — a color change alone is too quiet at this size.
 */
.vam-window__button {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--vam-radius-sm);
  background: transparent;
  color: var(--vam-fg-muted);
  cursor: pointer;
  transition:
    background var(--vam-transition),
    color var(--vam-transition);
}

.vam-window__button:hover {
  background: var(--vam-accent-soft);
  color: var(--vam-fg);
}

.vam-window__button:active {
  background: var(--vam-surface-sunken);
  color: var(--vam-accent);
}

.vam-window__button:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-window__icon--flipped {
  transform: rotate(180deg);
}

.vam-window__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vam-space-4);
  min-height: 0;
  padding: var(--vam-space-4);
}
</style>
