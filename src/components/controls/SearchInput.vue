<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import { IconSearch } from '../icons/index'

/**
 * Search field.
 *
 * Carries no background of its own: in the map toolbar the controls float over
 * the canvas, and the toolbar plate provides the surface.
 *
 * Debouncing lives in `useFilters`, not here: the field has to react to every
 * keystroke or typing feels stuck. Only the graph recomputation is deferred.
 */
const model = defineModel<string>({ default: '' })

const props = defineProps<{
  /** Number of direct hits; `undefined` hides the counter. */
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
  <div class="vam-search">
    <IconSearch class="vam-search__icon" />

    <input
      v-model="model"
      type="search"
      class="vam-search__input"
      :aria-label="t('search.label')"
      :placeholder="t('search.placeholder')"
    />

    <!-- Live region: keyboard users hear the result without leaving the field. -->
    <span v-if="summary" class="vam-search__summary" role="status" aria-live="polite">
      {{ summary }}
    </span>

    <button
      v-if="hasQuery"
      type="button"
      class="vam-search__clear"
      :aria-label="t('search.clear')"
      @click="model = ''"
    >
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>

<style>
.vam-search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--vam-space-2);
  align-self: stretch;
  padding: 6px 10px;
  min-width: 0;
}

.vam-search__input {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  line-height: var(--vam-line-height-sm);
}

.vam-search__input::placeholder {
  color: var(--vam-fg-subtle);
}

/* The native type="search" clear button is replaced by our own. */
.vam-search__input::-webkit-search-cancel-button {
  display: none;
}

.vam-search__input:focus {
  outline: none;
}

.vam-search__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: var(--vam-fg-muted);
}

.vam-search__clear {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--vam-radius-sm);
  background: transparent;
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-lg);
  line-height: 1;
  cursor: pointer;
}

.vam-search__clear:hover {
  color: var(--vam-fg-subtle);
}

.vam-search__clear:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-search__summary {
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
  white-space: nowrap;
}
</style>
