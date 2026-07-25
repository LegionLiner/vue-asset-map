<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef } from 'vue'
import { MapWindow, NetworkMap, type FilterState, type NetworkMapExposed, type ThemeMode } from 'network-map'
import {
  entities as fixtureEntities,
  filterGroups,
  links as fixtureLinks,
  statusColors,
  views,
  type AssetMeta,
  type DemoEntity,
  type DemoLink,
} from '@fixtures/infra'
// Ядро без Vue доступно отдельным подпутём — здесь оно считает подпись к кнопке.
import { blastRadius, buildGraph } from 'network-map/core'
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

/**
 * Демо реального кейса: два вида одной инфраструктуры, встроенные контролы,
 * свёртка фермы контейнеров, кастомная панель подробностей и трассировка пути.
 */

const map = useTemplateRef<NetworkMapExposed>('map')

const theme = ref<ThemeMode>('light')
const viewId = ref(views[0]?.id)
const selection = ref<string[]>([])
const expanded = ref(new Set<string>())
const collapsedNodes = ref(new Set<string>())
const filters = ref<FilterState>({ query: '', kinds: [], statuses: [] })
/** Открытые окна подробностей: их может быть несколько сразу. */
const openDetails = ref<string[]>([])

/**
 * Режим «заражения».
 *
 * Помечаем координатор VPN — карта сама посчитает, что он захватывает. Радиус
 * управляется шагами, чтобы распространение было видно постепенно: на первом шаге
 * краснеют только прямые связи, дальше захват расходится по графу.
 */
const infectedSource = 'vps-tailscale'
const infectionOn = ref(false)
const infectionDepth = ref(1)
const infected = computed(() => (infectionOn.value ? [infectedSource] : []))

/**
 * Тот же захват, посчитанный самим приложением через `network-map/core`.
 *
 * Нужен только для подписи «захвачено N узлов»: карта считает его внутри теми же
 * функциями, поэтому число рядом с кнопкой всегда совпадает с тем, что покрашено.
 */
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
/** Раскрытые списки фильтров: библиотека отдаёт их наружу, храним у себя. */
const openFilterGroups = ref<string[] | undefined>(undefined)

/** Свои узлы добавляются в те же массивы, что пришли из фикстуры. */
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

/** «Показать путь» работает ровно между двумя выбранными узлами. */
const canTracePath = computed(() => selection.value.length === 2)
const lastPath = ref<string[] | undefined>(undefined)

function tracePath(): void {
  const [from, to] = selection.value
  if (from === undefined || to === undefined) return
  const path = map.value?.highlightPath(from, to)
  lastPath.value = path && path.length > 0 ? path : undefined
}

function clearPath(): void {
  map.value?.clearHighlight()
  lastPath.value = undefined
}

// --- Модалка добавления актива --------------------------------------------

const addOpen = ref(false)

const draft = reactive({
  label: '',
  kind: 'workstation',
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

  // Новые массивы, а не push: карта пересчитывает индексы по смене ссылки на
  // массив — так работает и любое приложение с иммутабельным стором.
  entities.value = [
    ...entities.value,
    {
      id,
      kind: draft.kind,
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
    { id: `l-${id}`, source: draft.parentId, target: id, layers: ['physical'], kind: 'solid' },
  ]

  addOpen.value = false
  draft.label = ''
  draft.externalIp = ''
  draft.overlayIp = ''
}

// --- Кастомное содержимое панели подробностей ------------------------------

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

// --- Демо-окно «История» ---------------------------------------------------

const historyStep = ref('сейчас')

/** Кнопки плеера. Зеркальные варианты — тот же путь, развёрнутый через CSS. */
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
      <span class="pg-bar__title">network-map · плейграунд</span>

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

        <!-- Шаги захвата: видно, как заражение расходится от Tailscale VPS. -->
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
      v-model:collapsed-nodes="collapsedNodes"
      v-model:filters="filters"
      v-model:open-filter-groups="openFilterGroups"
      v-model:open-details="openDetails"
      class="pg-map"
      :entities="entities"
      :links="links"
      :views="views"
      :theme="theme"
      :theme-config="{ statusColors, kindIcons }"
      :filter-options="{ groups: filterGroups }"
      :max-details-windows="3"
      :infected="infected"
      :infection-options="{ maxDepth: infectionDepth }"
      show-minimap
    >
      <!-- Правый слот шапки карты: место для действий приложения. -->
      <template #toolbar-right>
        <button type="button" class="pg-add" @click="openAdd">Добавить</button>
      </template>

      <!--
        Своё окно поверх окон подробностей. Собрано из <MapWindow>: шапка,
        перетаскивание и токены темы приходят из библиотеки, содержимое — наше.
        `header-only` — окно без тела, `closable: false` — закрыть его нельзя.
      -->
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

      <!-- Панель подробностей: библиотека даёт окно, шапку, кнопки и табы;
           наполнение — наше. Пакет не знает наших полей `meta`. -->
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

    <!-- Модалка добавления — реализация приложения, а не библиотеки. -->
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
          <select v-model="draft.kind">
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
