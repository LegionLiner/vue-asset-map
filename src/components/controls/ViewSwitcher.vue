<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import type { NetworkView } from '../../types/view'

/**
 * Projection switcher: a segmented control on an opaque plate.
 *
 * Buttons with `aria-pressed` rather than a `<select>`: there are usually two or
 * three views, and switching in one click beats compactness. View captions come
 * from the data — the package knows no view name in advance.
 */
const model = defineModel<string | undefined>({ default: undefined })

const props = defineProps<{
  views: NetworkView[]
}>()

const t = useTranslate()

/** Active view is the selected one, or the first — matching `resolveView`. */
const activeId = computed(() => {
  if (model.value !== undefined && props.views.some((view) => view.id === model.value)) {
    return model.value
  }
  return props.views[0]?.id
})

function select(viewId: string): void {
  if (viewId === model.value) return
  model.value = viewId
}
</script>

<template>
  <div class="vnm-views" role="group" :aria-label="t('view.switch')">
    <button
      v-for="view in views"
      :key="view.id"
      type="button"
      class="vnm-views__button"
      :class="{ 'vnm-views__button--active': view.id === activeId }"
      :aria-pressed="view.id === activeId"
      @click="select(view.id)"
    >
      <span class="vnm-views__label">{{ view.label }}</span>
      <!-- An invisible bold copy fixes the button width. The active state is set
           in 700 and the idle one in 400, so without reserving room for the bold
           text the buttons — and the whole switcher — would resize on each
           switch. -->
      <span class="vnm-views__sizer" aria-hidden="true">{{ view.label }}</span>
    </button>
  </div>
</template>

<style>
.vnm-views {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vnm-space-2);
  height: var(--vnm-toolbar-height);
  padding: var(--vnm-space-1);
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface);
}

/* A single grid cell: the caption and the invisible bold copy stack on top of
   each other, so the width is always computed from the bold variant. */
.vnm-views__button {
  display: grid;
  align-self: stretch;
  align-items: center;
  justify-items: center;
  padding: 2px var(--vnm-space-2);
  border: 0;
  border-radius: var(--vnm-radius-md);
  background: transparent;
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  font-weight: 400;
  line-height: var(--vnm-line-height);
  white-space: nowrap;
  cursor: pointer;
}

.vnm-views__label,
.vnm-views__sizer {
  grid-area: 1 / 1;
}

.vnm-views__sizer {
  font-weight: var(--vnm-font-weight-bold);
  visibility: hidden;
  pointer-events: none;
}

.vnm-views__button--active {
  background: var(--vnm-accent-soft);
  font-weight: var(--vnm-font-weight-bold);
}

.vnm-views__button:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}
</style>
