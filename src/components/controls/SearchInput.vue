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
  <div class="vnm-search">
    <IconSearch class="vnm-search__icon" />

    <input
      v-model="model"
      type="search"
      class="vnm-search__input"
      :aria-label="t('search.label')"
      :placeholder="t('search.placeholder')"
    />

    <!-- Live region: keyboard users hear the result without leaving the field. -->
    <span v-if="summary" class="vnm-search__summary" role="status" aria-live="polite">
      {{ summary }}
    </span>

    <button
      v-if="hasQuery"
      type="button"
      class="vnm-search__clear"
      :aria-label="t('search.clear')"
      @click="model = ''"
    >
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>

<style>
.vnm-search {
  display: flex;
  flex: 1 1 auto;
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

/* The native type="search" clear button is replaced by our own. */
.vnm-search__input::-webkit-search-cancel-button {
  display: none;
}

.vnm-search__input:focus {
  outline: none;
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
