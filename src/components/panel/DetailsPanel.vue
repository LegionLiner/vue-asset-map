<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DetailsSection from './DetailsSection.vue'
import { useMapContext } from '../../composables/useMapContext'
import { incidentLinks, otherEnd } from '../../core/graph'
import type { NetworkEntity } from '../../types/entity'

/**
 * Панель подробностей.
 *
 * Пакет даёт только каркас: шапку с именем и типом, кнопку закрытия и табы.
 * Содержимое — за слотом `#details`; встроенный плоский список полей из `meta`
 * существует как fallback для демо, а не как «правильный» вид панели. Пакет не
 * знает ни имён полей потребителя, ни того, какие из них важны.
 */
const props = defineProps<{
  entity: NetworkEntity<unknown>
}>()

const emit = defineEmits<{ close: [] }>()

const map = useMapContext()

type TabId = 'overview' | 'links'

const tabs: readonly { id: TabId; labelKey: 'details.tab.overview' | 'details.tab.links' }[] = [
  { id: 'overview', labelKey: 'details.tab.overview' },
  { id: 'links', labelKey: 'details.tab.links' },
]

const activeTab = ref<TabId>('overview')

// Смена узла возвращает панель на первый таб: «Связи» предыдущего узла к новому
// отношения не имеют, и оставлять их открытыми — вводить в заблуждение.
watch(
  () => props.entity.id,
  () => {
    activeTab.value = 'overview'
  },
)

const statusColor = computed(() => map.statusColorOf(props.entity.status))

const neighbors = computed(() =>
  incidentLinks(map.graph.value, props.entity.id).map((link) => {
    const otherId = otherEnd(link, props.entity.id)
    return {
      id: link.id,
      layers: link.layers.join(', '),
      label: map.entityById(otherId)?.label ?? otherId,
    }
  }),
)

/** Плоский список полей `meta` — только для fallback-режима. */
const metaRows = computed(() => {
  const meta = props.entity.meta
  if (meta === null || typeof meta !== 'object') return []

  return Object.entries(meta as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(', ') : String(value),
    }))
})

const detailsSlot = computed(() => map.slot('details'))
const headerSlot = computed(() => map.slot('details-header'))
</script>

<template>
  <aside class="vnm-panel" :aria-label="map.t('details.title')">
    <header class="vnm-panel__header">
      <component :is="headerSlot" v-if="headerSlot" :entity="entity" :close="() => emit('close')" />
      <div v-else class="vnm-panel__heading">
        <span class="vnm-panel__title">{{ entity.label }}</span>
        <span class="vnm-panel__subtitle">
          <span class="vnm-panel__kind">{{ entity.kind }}</span>
          <span
            v-if="entity.status"
            class="vnm-panel__status"
            :style="statusColor ? { backgroundColor: statusColor } : undefined"
            :title="map.t('node.status', { status: entity.status })"
          />
          <span v-if="entity.status" class="vnm-panel__status-text">{{ entity.status }}</span>
        </span>
      </div>

      <button
        type="button"
        class="vnm-panel__close"
        :aria-label="map.t('details.close')"
        @click="emit('close')"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <div class="vnm-panel__tabs" role="tablist" :aria-label="map.t('details.title')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="vnm-panel__tab"
        :class="{ 'vnm-panel__tab--active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ map.t(tab.labelKey) }}
      </button>
    </div>

    <div class="vnm-panel__content" role="tabpanel">
      <component
        :is="detailsSlot"
        v-if="detailsSlot"
        :entity="entity"
        :close="() => emit('close')"
        :tab="activeTab"
      />

      <!-- Fallback: ровно столько, чтобы демо было осмысленным. -->
      <template v-else-if="activeTab === 'overview'">
        <DetailsSection :title="map.t('details.id')">
          <span class="vnm-field__key">{{ map.t('details.id') }}</span>
          <span class="vnm-field__value">{{ entity.id }}</span>
          <span class="vnm-field__key">{{ map.t('details.kind') }}</span>
          <span class="vnm-field__value">{{ entity.kind }}</span>
          <template v-if="entity.status">
            <span class="vnm-field__key">{{ map.t('details.status') }}</span>
            <span class="vnm-field__value">{{ entity.status }}</span>
          </template>
        </DetailsSection>

        <DetailsSection v-if="entity.sublabels?.length" :title="map.t('details.addresses')">
          <template v-for="sublabel in entity.sublabels" :key="sublabel">
            <span class="vnm-field__key">—</span>
            <span class="vnm-field__value">{{ sublabel }}</span>
          </template>
        </DetailsSection>

        <DetailsSection :title="map.t('details.meta')" :empty="metaRows.length === 0">
          <template #empty>{{ map.t('details.empty') }}</template>
          <template v-for="row in metaRows" :key="row.key">
            <span class="vnm-field__key">{{ row.key }}</span>
            <span class="vnm-field__value">{{ row.value }}</span>
          </template>
        </DetailsSection>
      </template>

      <template v-else>
        <DetailsSection :title="map.t('details.neighbors')" :empty="neighbors.length === 0">
          <template #empty>{{ map.t('filter.empty') }}</template>
          <template v-for="neighbor in neighbors" :key="neighbor.id">
            <span class="vnm-field__key">{{ neighbor.layers }}</span>
            <span class="vnm-field__value">{{ neighbor.label }}</span>
          </template>
        </DetailsSection>
      </template>
    </div>
  </aside>
</template>

<style>
.vnm-panel {
  display: flex;
  flex: 0 0 var(--vnm-panel-width);
  flex-direction: column;
  width: var(--vnm-panel-width);
  min-height: 0;
  border-left: 1px solid var(--vnm-border);
  background: var(--vnm-surface);
}

.vnm-panel__header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--vnm-space-2);
  padding: var(--vnm-space-3);
  border-bottom: 1px solid var(--vnm-border);
}

.vnm-panel__heading {
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-1);
  min-width: 0;
}

.vnm-panel__title {
  overflow: hidden;
  font-size: var(--vnm-font-size-lg);
  font-weight: var(--vnm-font-weight-bold);
  text-overflow: ellipsis;
}

.vnm-panel__subtitle {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
}

.vnm-panel__kind {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vnm-panel__status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vnm-status-unknown);
}

.vnm-panel__close {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-lg);
  line-height: 1;
  cursor: pointer;
}

.vnm-panel__close:hover {
  border-color: var(--vnm-border);
  background: var(--vnm-surface-sunken);
  color: var(--vnm-fg);
}

.vnm-panel__close:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-panel__tabs {
  display: flex;
  flex: 0 0 auto;
  gap: var(--vnm-space-1);
  padding: 0 var(--vnm-space-3);
  border-bottom: 1px solid var(--vnm-border);
}

.vnm-panel__tab {
  padding: var(--vnm-space-2) var(--vnm-space-2);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--vnm-fg-muted);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  cursor: pointer;
}

.vnm-panel__tab:hover {
  color: var(--vnm-fg);
}

.vnm-panel__tab--active {
  border-bottom-color: var(--vnm-accent);
  color: var(--vnm-fg);
  font-weight: var(--vnm-font-weight-medium);
}

.vnm-panel__tab:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: -2px;
}

.vnm-panel__content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vnm-space-4);
  padding: var(--vnm-space-3);
  overflow-y: auto;
}
</style>
