<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import { IconSearch } from '../icons/index'

/**
 * Поле поиска.
 *
 * Без своего фона: в тулбаре карты контролы «висят» над полотном, а фон даёт
 * общая плашка тулбара.
 *
 * Debounce живёт в `useFilters`, а не здесь: поле обязано отзываться на каждое
 * нажатие, иначе ввод «залипает». Отложен только пересчёт графа.
 */
const model = defineModel<string>({ default: '' })

const props = defineProps<{
  /** Число прямых совпадений. `undefined` — не показывать счётчик. */
  resultCount?: number
}>()

const t = useTranslate()

const hasQuery = computed(() => model.value.length > 0)

const summary = computed(() => {
  if (props.resultCount === undefined || !hasQuery.value) return undefined
  return props.resultCount > 0
    ? t.value('search.results', { count: props.resultCount })
    : t.value('search.empty')
})
</script>

<template>
  <div class="vnm-search">
    <input
      v-model="model"
      type="search"
      class="vnm-search__input"
      :aria-label="t('search.label')"
      :placeholder="t('search.placeholder')"
    />

    <button
      v-if="hasQuery"
      type="button"
      class="vnm-search__clear"
      :aria-label="t('search.clear')"
      @click="model = ''"
    >
      <span aria-hidden="true">×</span>
    </button>

    <IconSearch v-else class="vnm-search__icon" />

    <!-- Счётчик в live-области: пользователь клавиатуры узнаёт результат, не
         уходя из поля. -->
    <span v-if="summary" class="vnm-search__summary" role="status" aria-live="polite">
      {{ summary }}
    </span>
  </div>
</template>

<style>
.vnm-search {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  align-self: stretch;
  padding: 6px 10px;
  min-width: 0;
}

.vnm-search__input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  line-height: var(--vnm-line-height-sm);
}

.vnm-search__input::placeholder {
  color: var(--vnm-fg-subtle);
}

/* Системный крестик у type="search" заменён своей кнопкой. */
.vnm-search__input::-webkit-search-cancel-button {
  display: none;
}

.vnm-search__input:focus {
  outline: none;
}

.vnm-search__input:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 2px;
}

.vnm-search__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: var(--vnm-fg-muted);
}

.vnm-search__clear {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-lg);
  line-height: 1;
  cursor: pointer;
}

.vnm-search__clear:hover {
  color: var(--vnm-fg-subtle);
}

.vnm-search__clear:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-search__summary {
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
  white-space: nowrap;
}
</style>
