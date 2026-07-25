<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import type { AssetView } from '../../types/view'

/**
 * Projection switcher: a segmented control on an opaque plate.
 *
 * Buttons with `aria-pressed` rather than a `<select>`: there are usually two or
 * three views, and switching in one click beats compactness. View captions come
 * from the data — the package knows no view name in advance.
 */
const model = defineModel<string | undefined>({ default: undefined })

const props = defineProps<{
  views: AssetView[]
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
  <div class="vam-views" role="group" :aria-label="t('view.switch')">
    <button
      v-for="view in views"
      :key="view.id"
      type="button"
      class="vam-views__button"
      :class="{ 'vam-views__button--active': view.id === activeId }"
      :aria-pressed="view.id === activeId"
      @click="select(view.id)"
    >
      <span class="vam-views__label">{{ view.label }}</span>
      <!-- An invisible bold copy fixes the button width. The active state is set
           in 700 and the idle one in 400, so without reserving room for the bold
           text the buttons — and the whole switcher — would resize on each
           switch. -->
      <span class="vam-views__sizer" aria-hidden="true">{{ view.label }}</span>
    </button>
  </div>
</template>

<style>
.vam-views {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--vam-space-2);
  height: var(--vam-toolbar-height);
  padding: var(--vam-space-1);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
}

/* A single grid cell: the caption and the invisible bold copy stack on top of
   each other, so the width is always computed from the bold variant. */
.vam-views__button {
  display: grid;
  align-self: stretch;
  align-items: center;
  justify-items: center;
  padding: 2px var(--vam-space-2);
  border: 0;
  border-radius: var(--vam-radius-md);
  background: transparent;
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  font-weight: 400;
  line-height: var(--vam-line-height);
  white-space: nowrap;
  cursor: pointer;
}

.vam-views__label,
.vam-views__sizer {
  grid-area: 1 / 1;
}

.vam-views__sizer {
  font-weight: var(--vam-font-weight-bold);
  visibility: hidden;
  pointer-events: none;
}

.vam-views__button--active {
  background: var(--vam-accent-soft);
  font-weight: var(--vam-font-weight-bold);
}

.vam-views__button:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}
</style>
