<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import type { NetworkView } from '../../types/view'

/**
 * Переключатель проекций: сегментированный контрол на белой плашке.
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
      <span class="vnm-views__label">{{ view.label }}</span>
      <!-- Невидимая копия жирным задаёт ширину кнопки. Активный режим по макету
           набран 700, обычный — 400, и без резерва под жирный текст кнопки (а с
           ними и весь переключатель) меняли бы размер при каждом переключении. -->
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

/* Grid в одну клетку: подпись и невидимая жирная копия лежат друг на друге,
   поэтому ширина кнопки всегда рассчитана по жирному варианту. */
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
