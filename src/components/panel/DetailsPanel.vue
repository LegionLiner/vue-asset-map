<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DetailsSection from './DetailsSection.vue'
import { useMapContext } from '../../composables/useMapContext'
import { useDraggableWindow } from '../../composables/useDraggableWindow'
import { incidentLinks, otherEnd } from '../../core/graph'
import { IconClose, IconCollapseWindow } from '../icons/index'
import type { NetworkEntity } from '../../types/entity'

/**
 * Подробности о сущности — плавающее перетаскиваемое окно.
 *
 * Окно, а не приклеенный сайдбар: карту читают по путям между узлами, и панель,
 * съедающая правую треть полотна, обрезает как раз то, что рассматривают. Окно
 * можно отодвинуть или сжать до шапки, не теряя выбранный узел.
 *
 * Пакет даёт только каркас: шапку с кнопками, имя, тип и табы. Содержимое — за
 * слотом `#details`; встроенный плоский список полей из `meta` существует как
 * fallback для демо, а не как «правильный» вид панели: пакет не знает ни имён
 * полей потребителя, ни того, какие из них важны.
 */
const props = defineProps<{
  entity: NetworkEntity<unknown>
}>()

const emit = defineEmits<{ close: [] }>()

const map = useMapContext()
const { style, dragging, onPointerDown, reset } = useDraggableWindow()

type TabId = 'overview' | 'links'

const tabs: readonly { id: TabId; labelKey: 'details.tab.overview' | 'details.tab.links' }[] = [
  { id: 'overview', labelKey: 'details.tab.overview' },
  { id: 'links', labelKey: 'details.tab.links' },
]

const activeTab = ref<TabId>('overview')
const collapsed = ref(false)

// Смена узла возвращает окно в исходное состояние: таб «Связи» и сдвиг
// относятся к предыдущему узлу, к новому они отношения не имеют.
watch(
  () => props.entity.id,
  () => {
    activeTab.value = 'overview'
    collapsed.value = false
    reset()
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

const collapseLabel = computed(() =>
  collapsed.value ? map.t('details.expandWindow') : map.t('details.collapseWindow'),
)
</script>

<template>
  <aside
    class="vnm-window"
    :class="{ 'vnm-window--collapsed': collapsed, 'vnm-window--dragging': dragging }"
    :style="style"
    :aria-label="map.t('details.title')"
  >
    <header class="vnm-window__header" @pointerdown="onPointerDown">
      <button
        type="button"
        class="vnm-window__button"
        :aria-label="map.t('details.close')"
        @click="emit('close')"
      >
        <IconClose />
      </button>

      <span class="vnm-window__caption">{{ entity.label }}</span>

      <button
        type="button"
        class="vnm-window__button"
        :aria-label="collapseLabel"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <IconCollapseWindow :class="{ 'vnm-window__icon--flipped': collapsed }" />
      </button>
    </header>

    <div v-if="!collapsed" class="vnm-window__body">
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
    </div>
  </aside>
</template>

<style>
.vnm-window {
  position: absolute;
  z-index: 20;
  top: var(--vnm-space-4);
  right: var(--vnm-space-4);
  display: flex;
  flex-direction: column;
  width: var(--vnm-window-width);
  max-width: calc(100% - var(--vnm-space-5));
  max-height: calc(100% - var(--vnm-space-5));
  border-radius: var(--vnm-window-radius);
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-lg);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  line-height: var(--vnm-line-height);
}

.vnm-window__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--vnm-space-2);
  height: var(--vnm-window-header-height);
  padding: var(--vnm-space-1);
  border-radius: var(--vnm-window-radius) var(--vnm-window-radius) 0 0;
  background: var(--vnm-surface-sunken);
  cursor: grab;
  /* Иначе браузер начнёт своё «перетаскивание» и выделение текста в шапке. */
  touch-action: none;
  user-select: none;
}

.vnm-window--dragging .vnm-window__header {
  cursor: grabbing;
}

/* Сжатое окно — только шапка: скругление снизу возвращается. */
.vnm-window--collapsed .vnm-window__header {
  border-radius: var(--vnm-window-radius);
}

.vnm-window__caption {
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--vnm-fg-subtle);
  font-size: var(--vnm-font-size-sm);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-window__button {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: var(--vnm-radius-sm);
  background: transparent;
  color: var(--vnm-fg-muted);
  cursor: pointer;
}

.vnm-window__button:hover {
  color: var(--vnm-fg-subtle);
}

.vnm-window__button:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-window__icon--flipped {
  transform: rotate(180deg);
}

.vnm-window__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--vnm-space-4);
  min-height: 0;
  padding: var(--vnm-space-4);
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
