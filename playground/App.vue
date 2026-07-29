<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { MapWindow, AssetMap, type FilterState, type AssetMapExposed, type ThemeMode } from 'vue-asset-map'
import {
  entities as fixtureEntities,
  filterGroups,
  linkTypes,
  links as fixtureLinks,
  nodeMarkers,
  statusColors,
  views,
  type AssetMeta,
  type DemoEntity,
  type DemoLink,
} from '@fixtures/infra'
import { blastRadius, buildGraph } from 'vue-asset-map/core'
import {
  CloudIcon,
  ContainerIcon,
  IconFastRewind,
  IconStepRewind,
  RouterIcon,
  ServerIcon,
  VpsIcon,
  WorkstationIcon,
} from './icons'

const map = useTemplateRef<AssetMapExposed>('map')

const theme = ref<ThemeMode>('light')
const viewId = ref(views[0]?.id)
const selection = ref<string[]>([])
const expanded = ref(new Set<string>())
const collapsedNodes = ref(new Set<string>())
const filters = ref<FilterState>({ query: '', types: [], statuses: [] })
const openDetails = ref<string[]>([])

/*
 * Расположение, расставленное руками, живёт в localStorage.
 *
 * Карта сама никуда не пишет: она отдаёт позиции через `v-model:positions`, а
 * хранить их — дело приложения. Здесь это браузер, в реальном продукте был бы
 * профиль пользователя на сервере.
 */
const POSITIONS_KEY = 'vam-playground-positions'

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? '{}')
  } catch {
    // Испорченная запись не должна мешать карте открыться.
    return {}
  }
}

const positions = ref(loadPositions())

watch(positions, (next) => localStorage.setItem(POSITIONS_KEY, JSON.stringify(next)), { deep: true })

const movedCount = computed(() => Object.keys(positions.value).length)

function resetPositions(): void {
  map.value?.resetPositions()
}

const infectedSource = 'vps-tailscale'
const infectionOn = ref(false)
const infectionDepth = ref(1)
const infected = computed(() => (infectionOn.value ? [infectedSource] : []))

const capturedIds = computed(() => {
  if (!infectionOn.value) return new Set<string>()
  return blastRadius(buildGraph(entities.value, links.value), infectedSource, {
    direction: 'downstream',
    maxDepth: infectionDepth.value,
    layers: [viewId.value ?? 'physical'],
  })
})

const capturedLabels = computed(() =>
  [...capturedIds.value]
    .map((id) => entities.value.find((entity) => entity.id === id)?.label ?? id)
    .join(', '),
)
const openFilterGroups = ref<string[] | undefined>(undefined)

const entities = ref<DemoEntity[]>([...fixtureEntities])
const links = ref<DemoLink[]>([...fixtureLinks])

const kindIcons = {
  cloud: CloudIcon,
  router: RouterIcon,
  hypervisor: ServerIcon,
  vps: VpsIcon,
  workstation: WorkstationIcon,
  container: ContainerIcon,
}

const currentView = computed(() => views.find((view) => view.id === viewId.value))

const canTracePath = computed(() => selection.value.length === 2)
const lastPath = ref<string[] | undefined>(undefined)

function onPathChange(path: string[]): void {
  lastPath.value = path.length > 0 ? path : undefined
}

function clearPath(): void {
  selection.value = []
}

/*
 * Editing. The map never writes to `entities` or `links` — it reports what was
 * asked for and this application applies it, which is exactly the split a real
 * one has between a map component and its store.
 */
const entityFields = [
  { key: 'label', label: 'Название' },
  {
    key: 'status',
    label: 'Состояние',
    type: 'select' as const,
    options: [
      { value: 'online', label: 'В сети' },
      { value: 'offline', label: 'Не в сети' },
      { value: 'degraded', label: 'Деградация' },
    ],
  },
  { key: 'meta.owner', label: 'Владелец' },
  { key: 'meta.os', label: 'ОС' },
  { key: 'meta.location', label: 'Размещение' },
]

function onEntityUpdate({ id, entity }: { id: string; entity: DemoEntity }): void {
  entities.value = entities.value.map((candidate) => (candidate.id === id ? entity : candidate))
}

function onEntityDelete({ id }: { id: string }): void {
  entities.value = entities.value.filter((candidate) => candidate.id !== id)
  // A node's links go with it, or the graph builder would report them dangling.
  links.value = links.value.filter((link) => link.source !== id && link.target !== id)
}

function onLinkCreate({ link }: { link: DemoLink }): void {
  links.value = [...links.value, link]
}

function onLinkUpdate({ id, link }: { id: string; link: DemoLink }): void {
  links.value = links.value.map((candidate) => (candidate.id === id ? link : candidate))
}

function onLinkDelete({ id }: { id: string }): void {
  links.value = links.value.filter((candidate) => candidate.id !== id)
}

const addOpen = ref(false)

const draft = reactive({
  label: '',
  type: 'workstation',
  parentId: 'keenetic-2',
  externalIp: '',
  overlayIp: '',
  subnet: 'vpn' as NonNullable<AssetMeta['subnet']>,
  assetType: 'device' as NonNullable<AssetMeta['assetType']>,
  severity: 'low' as NonNullable<AssetMeta['severity']>,
})

const canSubmit = computed(() => draft.label.trim().length > 0)

function openAdd(): void {
  addOpen.value = true
}

function submitAdd(): void {
  if (!canSubmit.value) return

  const id = `custom-${Date.now()}`
  const sublabels = [draft.externalIp, draft.overlayIp].filter((value) => value.length > 0)

  entities.value = [
    ...entities.value,
    {
      id,
      type: draft.type,
      label: draft.label.trim(),
      status: 'online',
      parentId: draft.parentId,
      ...(sublabels.length > 0 ? { sublabels } : {}),
      meta: {
        subnet: draft.subnet,
        assetType: draft.assetType,
        severity: draft.severity,
        owner: 'demo',
      },
    },
  ]

  links.value = [
    ...links.value,
    { id: `l-${id}`, source: draft.parentId, target: id, layers: ['physical'], type: 'solid' },
  ]

  addOpen.value = false
  draft.label = ''
  draft.externalIp = ''
  draft.overlayIp = ''
}

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
  subnet: 'Подсеть',
  assetType: 'Тип актива',
  severity: 'Критичность',
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
  return links.value.filter((link) => link.source === id || link.target === id)
}

const historyStep = ref('сейчас')

const historyControls = [
  { id: 'fast-back', icon: IconFastRewind, label: 'В начало', step: '−1 час', mirrored: false },
  { id: 'back', icon: IconStepRewind, label: 'Шаг назад', step: '−5 минут', mirrored: false },
  { id: 'forward', icon: IconStepRewind, label: 'Шаг вперёд', step: '+5 минут', mirrored: true },
  { id: 'fast-forward', icon: IconFastRewind, label: 'В конец', step: 'сейчас', mirrored: true },
]
</script>

<template>
  <div class="pg-shell">
    <div class="pg-bar">
      <span class="pg-bar__title">vue-asset-map · плейграунд</span>

      <button type="button" @click="theme = theme === 'dark' ? 'light' : 'dark'">
        Тема: {{ theme === 'dark' ? 'тёмная' : 'светлая' }}
      </button>

      <span class="pg-infection">
        <button
          type="button"
          :class="{ 'pg-bar__button--on': infectionOn }"
          @click="infectionOn = !infectionOn"
        >
          Заражение: {{ infectionOn ? 'вкл' : 'выкл' }}
        </button>

        <template v-if="infectionOn">
          <button
            type="button"
            :disabled="infectionDepth <= 0"
            aria-label="Уменьшить радиус захвата"
            @click="infectionDepth -= 1"
          >
            −
          </button>
          <span class="pg-infection__depth">шаг {{ infectionDepth }}</span>
          <button
            type="button"
            :disabled="infectionDepth >= 5"
            aria-label="Увеличить радиус захвата"
            @click="infectionDepth += 1"
          >
            +
          </button>
          <span class="pg-infection__count" :title="capturedLabels">захвачено: {{ capturedIds.size }}</span>
        </template>
      </span>

      <button type="button" :disabled="!lastPath" @click="clearPath">Сбросить путь</button>
      <button type="button" @click="map?.fitView()">Вся карта</button>
      <button type="button" @click="map?.relayout()">Перестроить</button>
      <button type="button" :disabled="movedCount === 0" @click="resetPositions">
        Сбросить расстановку{{ movedCount ? ` (${movedCount})` : '' }}
      </button>

      <span class="pg-bar__hint">
        <template v-if="lastPath">Путь: {{ lastPath.join(' → ') }}</template>
        <template v-else-if="canTracePath">Между выбранными узлами пути нет</template>
        <template v-else>
          Shift+клик — путь · правый клик — меню · тяните от узла к узлу, чтобы связать
        </template>
      </span>
    </div>

    <AssetMap
      ref="map"
      v-model:view="viewId"
      v-model:selection="selection"
      v-model:expanded="expanded"
      v-model:collapsed-nodes="collapsedNodes"
      v-model:filters="filters"
      v-model:open-filter-groups="openFilterGroups"
      v-model:open-details="openDetails"
      v-model:positions="positions"
      class="pg-map"
      :entities="entities"
      :links="links"
      :views="views"
      :theme="theme"
      :theme-config="{ statusColors, kindIcons }"
      :filter-options="{ groups: filterGroups }"
      :markers="nodeMarkers"
      :max-details-windows="3"
      :infected="infected"
      :infection-options="{ maxDepth: infectionDepth }"
      :link-types="linkTypes"
      :entity-fields="entityFields"
      show-legend
      show-context-menu
      editable
      show-minimap
      auto-fit-view
      auto-path
      @path-change="onPathChange"
      @entity-update="onEntityUpdate"
      @entity-delete="onEntityDelete"
      @link-create="onLinkCreate"
      @link-update="onLinkUpdate"
      @link-delete="onLinkDelete"
    >
      <template #toolbar-right>
        <button type="button" class="pg-add" @click="openAdd">Добавить</button>
      </template>

      <template #windows>
        <MapWindow class="pg-history" header-only drag-handle :closable="false" :collapsible="false">
          <template #header>
            <span class="pg-history__controls">
              <button
                v-for="control in historyControls"
                :key="control.id"
                type="button"
                class="pg-history__button"
                :class="{ 'pg-history__button--mirrored': control.mirrored }"
                :aria-label="control.label"
                :title="control.label"
                @click="historyStep = control.step"
              >
                <component :is="control.icon" />
              </button>
            </span>
            <span class="pg-history__label">{{ historyStep }}</span>
          </template>
        </MapWindow>
      </template>

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
    </AssetMap>

    <div v-if="addOpen" class="pg-modal" role="dialog" aria-modal="true" aria-label="Добавить актив">
      <div class="pg-modal__box">
        <div class="pg-modal__head">
          <strong>Добавить актив</strong>
          <button type="button" @click="addOpen = false">×</button>
        </div>

        <label class="pg-field">
          <span>Название</span>
          <input v-model="draft.label" type="text" placeholder="Новый хост" />
        </label>

        <label class="pg-field">
          <span>Тип узла</span>
          <select v-model="draft.type">
            <option value="workstation">workstation</option>
            <option value="vps">vps</option>
            <option value="router">router</option>
            <option value="hypervisor">hypervisor</option>
            <option value="container">container</option>
          </select>
        </label>

        <label class="pg-field">
          <span>Родитель</span>
          <select v-model="draft.parentId">
            <option v-for="candidate in entities" :key="candidate.id" :value="candidate.id">
              {{ candidate.label }}
            </option>
          </select>
        </label>

        <label class="pg-field">
          <span>Внешний IP</span>
          <input v-model="draft.externalIp" type="text" placeholder="10.38.24.80" />
        </label>

        <label class="pg-field">
          <span>Оверлей IP</span>
          <input v-model="draft.overlayIp" type="text" placeholder="100.64.0.80" />
        </label>

        <label class="pg-field">
          <span>Подсеть</span>
          <select v-model="draft.subnet">
            <option value="internet">Интернет</option>
            <option value="vpn">VPN</option>
            <option value="docker">Docker Bridge</option>
          </select>
        </label>

        <label class="pg-field">
          <span>Критичность</span>
          <select v-model="draft.severity">
            <option value="critical">Критический</option>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>
        </label>

        <div class="pg-modal__actions">
          <button type="button" @click="addOpen = false">Отмена</button>
          <button type="button" :disabled="!canSubmit" @click="submitAdd">Добавить</button>
        </div>
      </div>
    </div>
  </div>
</template>
