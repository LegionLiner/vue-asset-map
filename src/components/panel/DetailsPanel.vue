<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailsSection from './DetailsSection.vue'
import MapWindow from '../MapWindow.vue'
import { useMapContext } from '../../composables/useMapContext'
import { incidentLinks, otherEnd } from '../../core/graph'
import type { AssetEntity, XY } from '../../types/entity'
import type { DetailsTabDef } from '../../types/props'

/**
 * Entity details inside a floating window.
 *
 * The window chrome is `<MapWindow>`; this is only its contents. The package
 * fills them in minimally — label, type, tabs and a flat list of `meta` fields as
 * a fallback. Real content belongs in the `#details` slot: the package knows
 * neither the consumer's field names nor which of them matter.
 *
 * Everything below `.vam-window__header` can be replaced or removed outright: the
 * caption through `title` or `#details-title`, the heading block through
 * `showHeading` or `#details-header`, the tabs through `tabs` or `#details-tabs`,
 * the body through `#details`. With all four taken over, nothing of the default
 * design survives but the title bar.
 */
const props = withDefaults(
  defineProps<{
    entity: AssetEntity<unknown>
    /** Offset in px, so several windows do not stack exactly on one another. */
    offset?: XY
    /** Title-bar caption. Falls back to `entity.label`. */
    title?: string
    /**
     * Show the heading block: the large label with the type and status line.
     *
     * @default true
     */
    showHeading?: boolean
    /**
     * Tabs to draw. `false` removes the strip; omitted keeps the built-in pair.
     */
    tabs?: readonly DetailsTabDef[] | false
  }>(),
  { showHeading: true, tabs: undefined },
)

const emit = defineEmits<{ close: [] }>()

const map = useMapContext()

/** The package's own tabs, used while `tabs` is not given. */
const builtinTabs = computed<readonly DetailsTabDef[]>(() => [
  { id: 'overview', label: map.t('details.tab.overview') },
  { id: 'links', label: map.t('details.tab.links') },
])

const tabs = computed<readonly DetailsTabDef[]>(() =>
  props.tabs === false ? [] : (props.tabs ?? builtinTabs.value),
)

/** Whether the window still renders the package's own body for a tab. */
const builtinBody = computed(() => props.tabs === undefined || props.tabs === false)

/**
 * Active tab.
 *
 * Never reset when the entity changes: the map keys its windows by entity id, so
 * a different entity is a different component instance with default state.
 *
 * Starts on the first declared tab rather than a fixed id, since custom tabs
 * carry ids the package cannot guess.
 */
const activeTab = ref<string>(tabs.value[0]?.id ?? 'overview')

function selectTab(id: string): void {
  activeTab.value = id
}

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
const titleSlot = computed(() => map.slot('details-title'))
const tabsSlot = computed(() => map.slot('details-tabs'))

const close = (): void => emit('close')
</script>

<template>
  <MapWindow
    class="vam-details"
    :offset="offset"
    :close-label="map.t('details.close')"
    :collapse-label="map.t('details.collapseWindow')"
    :expand-label="map.t('details.expandWindow')"
    @close="close"
  >
    <!-- The caption is a slot rather than the `title` prop whenever
         `#details-title` is filled: a prop can only carry a string, and a
         consumer replacing the design wants markup there. -->
    <template #header="{ collapsed }">
      <component :is="titleSlot" v-if="titleSlot" :entity="entity" :collapsed="collapsed" :close="close" />
      <template v-else>{{ title ?? entity.label }}</template>
    </template>

    <div v-if="showHeading" class="vam-window__heading">
      <component :is="headerSlot" v-if="headerSlot" :entity="entity" :close="close" />
      <template v-else>
        <span class="vam-window__title">{{ entity.label }}</span>
        <span class="vam-window__subtitle">
          <span class="vam-window__kind">{{ entity.type }}</span>
          <template v-if="entity.status">
            <span
              class="vam-window__status"
              :style="statusColor ? { backgroundColor: statusColor } : undefined"
            />
            <span>{{ entity.status }}</span>
          </template>
        </span>
      </template>
    </div>

    <template v-if="tabs.length > 0">
      <component
        :is="tabsSlot"
        v-if="tabsSlot"
        :entity="entity"
        :tabs="tabs"
        :active="activeTab"
        :select="selectTab"
      />
      <div v-else class="vam-window__tabs" role="tablist" :aria-label="map.t('details.title')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="vam-window__tab"
          :class="{ 'vam-window__tab--active': activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="selectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </template>

    <div class="vam-window__content" role="tabpanel">
      <component :is="detailsSlot" v-if="detailsSlot" :entity="entity" :close="close" :tab="activeTab" />

      <!-- Fallback: just enough for the package to be usable without the slot.
           Skipped once custom tabs are in play — the package has no content to
           show under a tab it does not know. -->
      <template v-else-if="builtinBody && activeTab === 'overview'">
        <DetailsSection :title="map.t('details.id')">
          <span class="vam-field__key">{{ map.t('details.id') }}</span>
          <span class="vam-field__value">{{ entity.id }}</span>
          <span class="vam-field__key">{{ map.t('details.type') }}</span>
          <span class="vam-field__value">{{ entity.type }}</span>
          <template v-if="entity.status">
            <span class="vam-field__key">{{ map.t('details.status') }}</span>
            <span class="vam-field__value">{{ entity.status }}</span>
          </template>
        </DetailsSection>

        <DetailsSection v-if="entity.sublabels?.length" :title="map.t('details.addresses')">
          <template v-for="sublabel in entity.sublabels" :key="sublabel">
            <span class="vam-field__key">—</span>
            <span class="vam-field__value">{{ sublabel }}</span>
          </template>
        </DetailsSection>

        <DetailsSection :title="map.t('details.meta')" :empty="metaRows.length === 0">
          <template #empty>{{ map.t('details.empty') }}</template>
          <template v-for="row in metaRows" :key="row.key">
            <span class="vam-field__key">{{ row.key }}</span>
            <span class="vam-field__value">{{ row.value }}</span>
          </template>
        </DetailsSection>
      </template>

      <template v-else-if="builtinBody">
        <DetailsSection :title="map.t('details.neighbors')" :empty="neighbors.length === 0">
          <template #empty>{{ map.t('filter.empty') }}</template>
          <template v-for="neighbor in neighbors" :key="neighbor.id">
            <span class="vam-field__key">{{ neighbor.layers }}</span>
            <span class="vam-field__value">{{ neighbor.label }}</span>
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
.vam-details {
  top: var(--vam-details-top);
  right: var(--vam-space-3);
}

.vam-window__heading {
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-1);
  min-width: 0;
}

.vam-window__title {
  overflow: hidden;
  font-size: var(--vam-font-size-lg);
  font-weight: var(--vam-font-weight-bold);
  line-height: var(--vam-line-height-lg);
  text-overflow: ellipsis;
}

.vam-window__subtitle {
  display: flex;
  align-items: center;
  gap: var(--vam-space-2);
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
}

.vam-window__kind {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vam-window__status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vam-status-unknown);
}

.vam-window__tabs {
  display: flex;
  flex: 0 0 auto;
  gap: var(--vam-space-1);
  border-bottom: 1px solid var(--vam-border);
}

.vam-window__tab {
  padding: var(--vam-space-1) var(--vam-space-2);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--vam-fg-muted);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size);
  cursor: pointer;
}

.vam-window__tab:hover {
  color: var(--vam-fg);
}

.vam-window__tab--active {
  border-bottom-color: var(--vam-accent);
  color: var(--vam-fg);
  font-weight: var(--vam-font-weight-bold);
}

.vam-window__tab:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: -2px;
}

.vam-window__content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vam-space-4);
  min-height: 0;
  overflow-y: auto;
}
</style>
