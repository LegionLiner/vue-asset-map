<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'

/**
 * Поле поиска по карте.
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

function clear(): void {
  model.value = ''
}
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
      @click="clear"
    >
      <span aria-hidden="true">×</span>
    </button>

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
  min-width: 0;
}

.vnm-search__input {
  width: 260px;
  max-width: 100%;
  min-width: 0;
  padding: var(--vnm-space-1) var(--vnm-space-2);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-surface);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
}

.vnm-search__input::placeholder {
  color: var(--vnm-fg-muted);
}

.vnm-search__input:focus-visible {
  border-color: var(--vnm-accent);
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: -1px;
}

.vnm-search__clear {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-surface);
  color: var(--vnm-fg-muted);
  line-height: 1;
  cursor: pointer;
}

.vnm-search__clear:hover {
  border-color: var(--vnm-border-strong);
  color: var(--vnm-fg);
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
