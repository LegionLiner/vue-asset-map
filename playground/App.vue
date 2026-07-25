<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { NetworkMap, type FilterState, type NetworkMapExposed, type ThemeMode } from 'network-map'
import {
  entities,
  links,
  statusColors,
  views,
  type AssetMeta,
  type DemoLink,
} from '@fixtures/infra'

/**
 * Демо реального кейса: два вида одной инфраструктуры, поиск, свёртка фермы
 * контейнеров, кастомная панель подробностей и трассировка пути.
 */

const map = useTemplateRef<NetworkMapExposed>('map')

const theme = ref<ThemeMode>('light')
const viewId = ref(views[0]?.id)
const selection = ref<string[]>([])
const expanded = ref(new Set<string>())
const filters = ref<FilterState>({ query: '', kinds: [], statuses: [] })

const currentView = computed(() => views.find((view) => view.id === viewId.value))

/** «Показать путь» работает ровно между двумя выбранными узлами. */
const canTracePath = computed(() => selection.value.length === 2)

function tracePath(): void {
  const [from, to] = selection.value
  if (from === undefined || to === undefined) return
  const path = map.value?.highlightPath(from, to)
  lastPath.value = path && path.length > 0 ? path : undefined
}

const lastPath = ref<string[] | undefined>(undefined)

function clearPath(): void {
  map.value?.clearHighlight()
  lastPath.value = undefined
}

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

/** Ярлыки для полей `meta` — это данные потребителя, библиотека их не знает. */
const metaLabels: Record<keyof AssetMeta, string> = {
  owner: 'Владелец',
  os: 'ОС',
  externalIp: 'Внешний IP',
  overlayIp: 'Оверлей',
  fqdn: 'FQDN',
  cpu: 'vCPU',
  ramGb: 'RAM, ГБ',
  location: 'Размещение',
  tags: 'Метки',
}

function metaRows(meta: AssetMeta | undefined): { key: string; label: string; value: string }[] {
  if (!meta) return []
  const rows: { key: string; label: string; value: string }[] = []
  for (const [key, label] of Object.entries(metaLabels)) {
    const value = meta[key as keyof AssetMeta]
    if (value === undefined || key === 'tags') continue
    rows.push({ key, label, value: String(value) })
  }
  return rows
}

function neighborsOf(id: string): DemoLink[] {
  return links.filter((link) => link.source === id || link.target === id)
}
</script>

<template>
  <div class="pg-shell">
    <div class="pg-bar">
      <span class="pg-bar__title">network-map · плейграунд</span>

      <label>
        Вид
        <select v-model="viewId">
          <option v-for="view in views" :key="view.id" :value="view.id">{{ view.label }}</option>
        </select>
      </label>

      <label>
        Поиск
        <input
          v-model="filters.query"
          type="search"
          placeholder="Dmitry, 10.38.24.*, 100.64.0.0/24"
          size="26"
        />
      </label>

      <button type="button" @click="toggleTheme">
        Тема: {{ theme === 'dark' ? 'тёмная' : 'светлая' }}
      </button>

      <button type="button" :disabled="!canTracePath" @click="tracePath">Показать путь</button>
      <button type="button" :disabled="!lastPath" @click="clearPath">Сбросить путь</button>
      <button type="button" @click="map?.fitView()">Вся карта</button>
      <button type="button" @click="map?.relayout()">Перестроить</button>

      <span class="pg-bar__hint">
        <template v-if="lastPath">Путь: {{ lastPath.join(' → ') }}</template>
        <template v-else-if="canTracePath">Выбрано 2 узла — можно строить путь</template>
        <template v-else>Выделено: {{ selection.length }} · Ctrl+клик добавляет узел</template>
      </span>
    </div>

    <NetworkMap
      ref="map"
      v-model:view="viewId"
      v-model:selection="selection"
      v-model:expanded="expanded"
      v-model:filters="filters"
      class="pg-map"
      :entities="entities"
      :links="links"
      :views="views"
      :theme="theme"
      :theme-config="{ statusColors }"
      :show-toolbar="false"
    >
      <!-- Панель подробностей: библиотека даёт контейнер, шапку, кнопку закрытия
           и табы; наполнение — наше. Пакет не знает наших полей `meta`. -->
      <template #details="{ entity, tab }">
        <div v-if="tab === 'links'" class="pg-details">
          <div class="pg-details__section-title">Связи ({{ neighborsOf(entity.id).length }})</div>
          <div class="pg-details__rows">
            <template v-for="link in neighborsOf(entity.id)" :key="link.id">
              <span class="pg-details__key">{{ link.layers.join(', ') }}</span>
              <span class="pg-details__value">
                {{ link.source === entity.id ? link.target : link.source }}
              </span>
            </template>
          </div>
        </div>

        <div v-else class="pg-details">
          <div v-if="entity.sublabels?.length">
            <div class="pg-details__section-title">Адреса</div>
            <div class="pg-details__rows">
              <template v-for="(sublabel, index) in entity.sublabels" :key="sublabel">
                <span class="pg-details__key">{{ index === 0 ? 'внешний' : 'оверлей' }}</span>
                <span class="pg-details__value">{{ sublabel }}</span>
              </template>
            </div>
          </div>

          <div v-if="metaRows(entity.meta as AssetMeta).length">
            <div class="pg-details__section-title">Атрибуты</div>
            <div class="pg-details__rows">
              <template v-for="row in metaRows(entity.meta as AssetMeta)" :key="row.key">
                <span class="pg-details__key">{{ row.label }}</span>
                <span class="pg-details__value">{{ row.value }}</span>
              </template>
            </div>
          </div>

          <div v-if="(entity.meta as AssetMeta)?.tags?.length">
            <div class="pg-details__section-title">Метки</div>
            <div class="pg-details__tags">
              <span v-for="tag in (entity.meta as AssetMeta).tags" :key="tag" class="pg-details__tag">
                {{ tag }}
              </span>
            </div>
          </div>

          <div class="pg-details__kind">
            Вид: {{ currentView?.label }} · подписи
            {{ currentView?.showSublabels === false ? 'скрыты' : 'показаны' }}
          </div>
        </div>
      </template>
    </NetworkMap>
  </div>
</template>
