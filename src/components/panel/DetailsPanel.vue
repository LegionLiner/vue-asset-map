<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailsSection from './DetailsSection.vue'
import MapWindow from '../MapWindow.vue'
import { useMapContext } from '../../composables/useMapContext'
import { incidentLinks, otherEnd } from '../../core/graph'
import type { NetworkEntity, XY } from '../../types/entity'

/**
 * Entity details inside a floating window.
 *
 * The window chrome is `<MapWindow>`; this is only its contents. The package
 * fills them in minimally — label, kind, tabs and a flat list of `meta` fields as
 * a fallback. Real content belongs in the `#details` slot: the package knows
 * neither the consumer's field names nor which of them matter.
 */
const props = defineProps<{
  entity: NetworkEntity<unknown>
  /** Offset in px, so several windows do not stack exactly on one another. */
  offset?: XY
}>()

const emit = defineEmits<{ close: [] }>()

const map = useMapContext()

type TabId = 'overview' | 'links'

const tabs: readonly { id: TabId; labelKey: 'details.tab.overview' | 'details.tab.links' }[] = [
  { id: 'overview', labelKey: 'details.tab.overview' },
  { id: 'links', labelKey: 'details.tab.links' },
]

/**
 * Active tab.
 *
 * Never reset when the entity changes: the map keys its windows by entity id, so
 * a different entity is a different component instance with default state.
 */
const activeTab = ref<TabId>('overview')

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

/** Flat list of `meta` fields, for the fallback rendering only. */
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
  <MapWindow
    class="vnm-details"
    :offset="offset"
    :title="entity.label"
    :close-label="map.t('details.close')"
    :collapse-label="map.t('details.collapseWindow')"
    :expand-label="map.t('details.expandWindow')"
    @close="emit('close')"
  >
    <div class="vnm-window__heading">
      <component :is="headerSlot" v-if="headerSlot" :entity="entity" :close="() => emit('close')" />
      <template v-else>
        <span class="vnm-window__title">{{ entity.label }}</span>
        <span class="vnm-window__subtitle">
          <span class="vnm-window__kind">{{ entity.kind }}</span>
          <template v-if="entity.status">
            <span
              class="vnm-window__status"
              :style="statusColor ? { backgroundColor: statusColor } : undefined"
            />
            <span>{{ entity.status }}</span>
          </template>
        </span>
      </template>
    </div>

    <div class="vnm-window__tabs" role="tablist" :aria-label="map.t('details.title')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="vnm-window__tab"
        :class="{ 'vnm-window__tab--active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ map.t(tab.labelKey) }}
      </button>
    </div>

    <div class="vnm-window__content" role="tabpanel">
      <component
        :is="detailsSlot"
        v-if="detailsSlot"
        :entity="entity"
        :close="() => emit('close')"
        :tab="activeTab"
      />

      <!-- Fallback: just enough for the package to be usable without the slot. -->
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
  </MapWindow>
</template>

<style>
/* Anchored to the top-right of the canvas; from there the user drags it. The
   top offset is a shared token: when the toolbar has application buttons on the
   right, windows start below them instead of on top. */
.vnm-details {
  top: var(--vnm-details-top);
  right: var(--vnm-space-3);
}

.vnm-window__heading {
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-1);
  min-width: 0;
}

.vnm-window__title {
  overflow: hidden;
  font-size: var(--vnm-font-size-lg);
  font-weight: var(--vnm-font-weight-bold);
  line-height: var(--vnm-line-height-lg);
  text-overflow: ellipsis;
}

.vnm-window__subtitle {
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
}

.vnm-window__kind {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vnm-window__status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vnm-status-unknown);
}

.vnm-window__tabs {
  display: flex;
  flex: 0 0 auto;
  gap: var(--vnm-space-1);
  border-bottom: 1px solid var(--vnm-border);
}

.vnm-window__tab {
  padding: var(--vnm-space-1) var(--vnm-space-2);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--vnm-fg-muted);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  cursor: pointer;
}

.vnm-window__tab:hover {
  color: var(--vnm-fg);
}

.vnm-window__tab--active {
  border-bottom-color: var(--vnm-accent);
  color: var(--vnm-fg);
  font-weight: var(--vnm-font-weight-bold);
}

.vnm-window__tab:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: -2px;
}

.vnm-window__content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vnm-space-4);
  min-height: 0;
  overflow-y: auto;
}
</style>
