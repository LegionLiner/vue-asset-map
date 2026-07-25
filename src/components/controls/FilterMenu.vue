<script setup lang="ts">
import { computed } from 'vue'
import { useTranslate } from '../../composables/useTranslate'
import type { FacetCounts, FilterState } from '../../types/filter'

/**
 * Фасетный фильтр по типам и состояниям.
 *
 * Раскрывается нативным `<details>`: поповер без библиотеки, с работающей
 * клавиатурой и без ручного управления фокусом. Значения фасетов — из данных, а
 * не из списка в коде: пакет не знает, какие типы узлов бывают у потребителя.
 *
 * Состояние всегда заменяется новым объектом, а не правится на месте: снаружи
 * оно может быть контролируемым через `v-model:filters`, и мутация не породила бы
 * события обновления.
 */
const model = defineModel<FilterState>({
  default: (): FilterState => ({ query: '', kinds: [], statuses: [] }),
})

const props = defineProps<{
  facets: FacetCounts
}>()

const t = useTranslate()

const kinds = computed(() => [...props.facets.kinds].sort(byLabel))
const statuses = computed(() => [...props.facets.statuses].sort(byLabel))

const activeCount = computed(() => model.value.kinds.length + model.value.statuses.length)

function byLabel(a: readonly [string, number], b: readonly [string, number]): number {
  return a[0].localeCompare(b[0])
}

function toggle(facet: 'kinds' | 'statuses', value: string): void {
  const current = model.value[facet]
  const next = current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value]

  model.value = { ...model.value, [facet]: next }
}

function reset(): void {
  if (activeCount.value === 0) return
  // Запрос не трогаем: сброс фасетов и сброс поиска — разные действия.
  model.value = { ...model.value, kinds: [], statuses: [] }
}
</script>

<template>
  <details class="vnm-filter">
    <summary class="vnm-filter__summary">
      <span>{{ t('filter.label') }}</span>
      <span v-if="activeCount > 0" class="vnm-filter__badge">{{ activeCount }}</span>
    </summary>

    <div class="vnm-filter__panel">
      <fieldset class="vnm-filter__group">
        <legend class="vnm-filter__legend">{{ t('filter.kinds') }}</legend>
        <p v-if="kinds.length === 0" class="vnm-filter__empty">{{ t('filter.empty') }}</p>
        <label v-for="[kind, count] in kinds" :key="kind" class="vnm-filter__option">
          <input type="checkbox" :checked="model.kinds.includes(kind)" @change="toggle('kinds', kind)" />
          <span class="vnm-filter__option-label">{{ kind }}</span>
          <span class="vnm-filter__count">{{ count }}</span>
        </label>
      </fieldset>

      <fieldset class="vnm-filter__group">
        <legend class="vnm-filter__legend">{{ t('filter.statuses') }}</legend>
        <p v-if="statuses.length === 0" class="vnm-filter__empty">{{ t('filter.empty') }}</p>
        <label v-for="[status, count] in statuses" :key="status" class="vnm-filter__option">
          <input
            type="checkbox"
            :checked="model.statuses.includes(status)"
            @change="toggle('statuses', status)"
          />
          <span class="vnm-filter__option-label">{{ status }}</span>
          <span class="vnm-filter__count">{{ count }}</span>
        </label>
      </fieldset>

      <button type="button" class="vnm-filter__reset" :disabled="activeCount === 0" @click="reset">
        {{ t('filter.reset') }}
      </button>
    </div>
  </details>
</template>

<style>
.vnm-filter {
  position: relative;
  flex: 0 0 auto;
}

.vnm-filter__summary {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  padding: var(--vnm-space-1) var(--vnm-space-3);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-surface);
  color: var(--vnm-fg);
  list-style: none;
  white-space: nowrap;
  cursor: pointer;
}

/* Свой маркер вместо системного треугольника. */
.vnm-filter__summary::-webkit-details-marker {
  display: none;
}

.vnm-filter__summary:hover {
  border-color: var(--vnm-border-strong);
}

.vnm-filter__summary:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-filter__badge {
  min-width: 16px;
  padding: 0 var(--vnm-space-1);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-accent);
  color: var(--vnm-accent-fg);
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  line-height: 16px;
  text-align: center;
}

.vnm-filter__panel {
  position: absolute;
  z-index: 10;
  top: calc(100% + var(--vnm-space-1));
  left: 0;
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-3);
  min-width: 220px;
  max-height: 320px;
  padding: var(--vnm-space-3);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-md);
  background: var(--vnm-surface-raised);
  box-shadow: var(--vnm-shadow-lg);
  overflow-y: auto;
}

.vnm-filter__group {
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-1);
  margin: 0;
  padding: 0;
  border: 0;
}

.vnm-filter__legend {
  padding: 0 0 var(--vnm-space-1);
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vnm-filter__option {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  cursor: pointer;
}

.vnm-filter__option-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-filter__count {
  color: var(--vnm-fg-muted);
  font-family: var(--vnm-font-mono);
  font-size: var(--vnm-font-size-sm);
}

.vnm-filter__empty {
  margin: 0;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
}

.vnm-filter__reset {
  padding: var(--vnm-space-1) var(--vnm-space-2);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-surface);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  cursor: pointer;
}

.vnm-filter__reset:disabled {
  color: var(--vnm-fg-muted);
  cursor: not-allowed;
}

.vnm-filter__reset:not(:disabled):hover {
  border-color: var(--vnm-border-strong);
}

.vnm-filter__reset:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}
</style>
