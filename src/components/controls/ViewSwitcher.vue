<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import type { NetworkView } from '../../types/view'

/**
 * Переключатель проекций.
 *
 * Кнопки с `aria-pressed`, а не `<select>`: видов обычно два-три, и переключение
 * в один клик важнее компактности. Названия видов приходят из данных — пакет не
 * знает ни одного имени вида заранее.
 */
const model = defineModel<string | undefined>({ default: undefined })

const props = defineProps<{
  views: NetworkView[]
}>()

const t = useTranslate()

/** Активен либо выбранный вид, либо первый — так же, как в `resolveView`. */
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
      {{ view.label }}
    </button>
  </div>
</template>

<style>
.vnm-views {
  display: flex;
  flex: 0 0 auto;
  padding: 2px;
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface-sunken);
}

.vnm-views__button {
  padding: var(--vnm-space-1) var(--vnm-space-3);
  border: 0;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  white-space: nowrap;
  cursor: pointer;
}

.vnm-views__button:hover {
  color: var(--vnm-fg);
}

.vnm-views__button--active {
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-sm);
  color: var(--vnm-fg);
  font-weight: var(--vnm-font-weight-medium);
}

.vnm-views__button:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}
</style>
