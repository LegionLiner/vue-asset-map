<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { AssetMap, MapWindow, en, ru } from 'vue-asset-map'
import type { AssetMapExposed, FieldDef, FilterState, LinkTypeDef } from 'vue-asset-map'
import { useSiteTheme } from '../theme/useSiteTheme'
import { useSiteLocale } from '../theme/useSiteLocale'
import ShapeNode from './custom/ShapeNode.vue'
import WiredEdge from './custom/WiredEdge.vue'
import type { DemoEntity, DemoLink } from './fixture'
import { entities as fixtureEntities, links as fixtureLinks, views } from './fixture'

/**
 * Everything replaceable, replaced.
 *
 * The map keeps the graph, the projections, the layout, the search and the
 * traversals; every pixel above them belongs to this file. Nothing here reaches
 * into the package's internals — each piece is a documented prop or slot.
 */
const theme = useSiteTheme()
const siteLang = useSiteLocale()
const map = useTemplateRef<AssetMapExposed>('map')

const entities = ref<DemoEntity[]>([...fixtureEntities])
const links = ref<DemoLink[]>([...fixtureLinks])

const viewId = ref('physical')
const filters = ref<FilterState>({ query: '', types: [], statuses: [] })
const openDetails = ref<string[]>([])

/* -- 1. Nodes and edges: components of our own, not slots inside the defaults -- */
const nodeTypes = {
  cloud: ShapeNode,
  router: ShapeNode,
  hypervisor: ShapeNode,
  vps: ShapeNode,
  workstation: ShapeNode,
  container: ShapeNode,
}

const edgeTypes = { solid: WiredEdge, dashed: WiredEdge, wifi: WiredEdge, fiber: WiredEdge }

const linkTypes: LinkTypeDef[] = [
  { id: 'fiber', label: 'Fibre', color: '#2f9e6f', width: 2 },
  { id: 'wifi', label: 'Wi-Fi', color: '#e0873a', dash: '3 3' },
  { id: 'solid', label: 'Ethernet', color: '#3a7ce0' },
  { id: 'dashed', label: 'VPN', color: '#7c5cff', dash: '6 4' },
]

/* -------------------------------- 2. Our own toolbar, filters and legend -- */
const KINDS = [
  { id: 'cloud', label: 'Cloud', shape: 'pill' },
  { id: 'router', label: 'Router', shape: 'diamond' },
  { id: 'hypervisor', label: 'Hypervisor', shape: 'square' },
  { id: 'vps', label: 'VPS', shape: 'hexagon' },
  { id: 'workstation', label: 'Workstation', shape: 'squircle' },
  { id: 'container', label: 'Container', shape: 'octagon' },
]

/** Type chips drive `v-model:filters` — the same state the built-in facets use. */
function toggleKind(id: string): void {
  const types = filters.value.types.includes(id)
    ? filters.value.types.filter((type) => type !== id)
    : [...filters.value.types, id]
  filters.value = { ...filters.value, types }
}

function setQuery(value: string): void {
  filters.value = { ...filters.value, query: value }
}

const activeCount = computed(() => filters.value.types.length + (filters.value.query ? 1 : 0))

function resetFilters(): void {
  filters.value = { query: '', types: [], statuses: [] }
}

/* ------------------------------ 3. Our own context menu and confirm modal -- */
const menu = ref<{ id: string; x: number; y: number } | undefined>()
const pendingDelete = ref<string | undefined>()

const stage = useTemplateRef<HTMLElement>('stage')

/**
 * `showContextMenu` stays off and we handle the event instead, which is what
 * the event has always been for. The package's own menu and dialog are perfectly
 * good; this demo replaces them to show that neither is compulsory.
 *
 * Positioned against the stage, not the event's `currentTarget`: by the time a
 * handler runs, `currentTarget` is already null.
 */
function onNodeContextMenu({ id, event }: { id: string; event: MouseEvent }): void {
  event.preventDefault()
  const bounds = stage.value?.getBoundingClientRect()
  menu.value = { id, x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) }
}

const menuEntity = computed(() => entities.value.find((entity) => entity.id === menu.value?.id))

/**
 * The menu's actions.
 *
 * Named functions rather than inline handlers: each does two things — act, then
 * dismiss the menu — and a multi-statement expression in a template is one
 * formatter away from not parsing at all.
 */
function inspect(): void {
  if (menu.value) openDetails.value = [menu.value.id]
  menu.value = undefined
}

function centre(): void {
  if (menu.value) void map.value?.focus(menu.value.id)
  menu.value = undefined
}

function askDelete(): void {
  pendingDelete.value = menu.value?.id
  menu.value = undefined
}

function confirmDelete(): void {
  const id = pendingDelete.value
  pendingDelete.value = undefined
  if (!id) return

  entities.value = entities.value.filter((entity) => entity.id !== id)
  links.value = links.value.filter((link) => link.source !== id && link.target !== id)
  openDetails.value = openDetails.value.filter((open) => open !== id)
}

/* --------------------------------------------- 4. Editing, our own form -- */
const entityFields: FieldDef[] = [
  { key: 'label', label: 'Display name' },
  {
    key: 'status',
    label: 'State',
    type: 'select',
    options: [
      { value: 'online', label: 'Online' },
      { value: 'offline', label: 'Offline' },
      { value: 'degraded', label: 'Degraded' },
    ],
  },
  { key: 'meta.owner', label: 'Owner' },
  { key: 'meta.location', label: 'Location' },
]

function onEntityUpdate({ id, entity }: { id: string; entity: DemoEntity }): void {
  entities.value = entities.value.map((candidate) => (candidate.id === id ? entity : candidate))
}

function onLinkUpdate({ id, link }: { id: string; link: DemoLink }): void {
  links.value = links.value.map((candidate) => (candidate.id === id ? link : candidate))
}

function onLinkCreate({ link }: { link: DemoLink }): void {
  links.value = [...links.value, link]
}

function onLinkDelete({ id }: { id: string }): void {
  links.value = links.value.filter((candidate) => candidate.id !== id)
}

/* ------------------------------------------------ 5. Wording, our own too -- */
/**
 * A handful of renamed strings, over the language of the page.
 *
 * Spreading `en` or `ru` matters: a partial dictionary merges over the package's
 * **default** locale, which is `ru`. Passing only the three overrides would
 * leave everything else Russian on the English side of the site.
 */
const OVERRIDES = {
  en: { 'details.close': 'Dismiss', 'link.title': 'Cable', 'edit.save': 'Apply' },
  ru: { 'details.close': 'Убрать', 'link.title': 'Кабель', 'edit.save': 'Применить' },
}

const locale = computed(() =>
  siteLang.value === 'ru' ? { ...ru, ...OVERRIDES.ru } : { ...en, ...OVERRIDES.en },
)

const tabs = [
  { id: 'facts', label: 'Facts' },
  { id: 'wiring', label: 'Wiring' },
]

function linksOf(id: string): DemoLink[] {
  return links.value.filter((link) => link.source === id || link.target === id)
}

function labelOf(id: string): string {
  return entities.value.find((entity) => entity.id === id)?.label ?? id
}
</script>

<template>
  <div class="cx" :class="`cx--${theme}`">
    <!-- 2a. The toolbar is ours: `showToolbar` is off, so the map draws no
         controls of its own and this bar is a plain part of the page. -->
    <header class="cx-bar">
      <span class="cx-bar__brand">NOC</span>

      <label class="cx-search">
        <span aria-hidden="true">⌕</span>
        <input
          :value="filters.query"
          placeholder="name, 10.38.24.0/24, 10.38.24.*"
          @input="setQuery(($event.target as HTMLInputElement).value)"
        />
      </label>

      <span class="cx-chips">
        <button
          v-for="kind in KINDS"
          :key="kind.id"
          type="button"
          class="cx-chip"
          :class="[`cx-chip--${kind.shape}`, { 'is-on': filters.types.includes(kind.id) }]"
          @click="toggleKind(kind.id)"
        >
          <i class="cx-chip__glyph" :class="`cx-glyph--${kind.shape}`" aria-hidden="true" />
          {{ kind.label }}
        </button>
      </span>

      <span class="cx-bar__spacer" />

      <select v-model="viewId" class="cx-select">
        <option v-for="view in views" :key="view.id" :value="view.id">{{ view.label }}</option>
      </select>

      <button type="button" class="cx-btn" :disabled="activeCount === 0" @click="resetFilters">
        Clear {{ activeCount ? `(${activeCount})` : '' }}
      </button>
      <button type="button" class="cx-btn" @click="map?.fitView()">Fit</button>
      <button type="button" class="cx-btn cx-btn--primary" @click="map?.relayout()">Re-lay out</button>
    </header>

    <div ref="stage" class="cx-stage" @click="menu = undefined">
      <AssetMap
        ref="map"
        v-model:view="viewId"
        v-model:filters="filters"
        v-model:open-details="openDetails"
        class="cx-map"
        :entities="entities"
        :links="links"
        :views="views"
        :theme="theme"
        :locale="locale"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :link-types="linkTypes"
        :entity-fields="entityFields"
        :details-tabs="tabs"
        :details-title="(entity) => entity.type.toUpperCase()"
        :show-toolbar="false"
        :show-details-heading="false"
        :collapse="false"
        editable
        auto-fit-view
        @node-context-menu="onNodeContextMenu"
        @entity-update="onEntityUpdate"
        @link-update="onLinkUpdate"
        @link-create="onLinkCreate"
        @link-delete="onLinkDelete"
      >
        <!-- 2b. Our legend, in the slot for floating windows. -->
        <template #windows>
          <MapWindow class="cx-legend" title="Cabling" :closable="false">
            <div class="cx-legend__rows">
              <span v-for="kind in linkTypes" :key="kind.id" class="cx-legend__row">
                <svg viewBox="0 0 28 6" class="cx-legend__line" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="28"
                    y2="3"
                    :stroke="kind.color"
                    :stroke-width="kind.width ?? 1.6"
                    :stroke-dasharray="kind.dash"
                  />
                </svg>
                {{ kind.label }}
              </span>
            </div>
          </MapWindow>
        </template>

        <!-- 3a. The window's caption, as markup rather than a string. -->
        <template #details-title="{ entity }">
          <span class="cx-win__title">
            <i class="cx-win__dot" :class="`cx-win__dot--${entity.status}`" />
            {{ entity.label }}
          </span>
        </template>

        <!-- 3b. Our tab strip: the ids reach `#details` as `tab`. -->
        <template #details-tabs="{ tabs: rows, active, select }">
          <nav class="cx-tabs">
            <button
              v-for="row in rows"
              :key="row.id"
              type="button"
              :class="{ 'is-on': row.id === active }"
              @click="select(row.id)"
            >
              {{ row.label }}
            </button>
          </nav>
        </template>

        <!-- 3c. Our body. -->
        <template #details="{ entity, tab }">
          <div v-if="tab === 'wiring'" class="cx-body">
            <p v-if="linksOf(entity.id).length === 0" class="cx-body__empty">Nothing attached.</p>
            <span v-for="link in linksOf(entity.id)" :key="link.id" class="cx-wire">
              <i :style="{ background: linkTypes.find((k) => k.id === link.type)?.color }" />
              {{ labelOf(link.source === entity.id ? link.target : link.source) }}
            </span>
          </div>

          <dl v-else class="cx-body cx-facts">
            <dt>ID</dt>
            <dd>{{ entity.id }}</dd>
            <dt>Kind</dt>
            <dd>{{ entity.type }}</dd>
            <dt>Owner</dt>
            <dd>{{ entity.meta?.owner ?? '—' }}</dd>
            <dt>Where</dt>
            <dd>{{ entity.meta?.location ?? '—' }}</dd>
          </dl>
        </template>

        <!-- 4a. Our edit form. Only the draft plumbing comes from the package. -->
        <template #details-edit="{ value, fields, values, setValue, save, cancel }">
          <form class="cx-form" @submit.prevent="save">
            <label v-for="field in fields" :key="field.key">
              <span>{{ field.label }}</span>
              <select
                v-if="field.type === 'select'"
                :value="values[field.key] ?? value[field.key.split('.')[0]]"
                @change="setValue(field.key, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <input
                v-else
                :value="values[field.key] ?? ''"
                :placeholder="String(field.label)"
                @input="setValue(field.key, ($event.target as HTMLInputElement).value)"
              />
            </label>

            <div class="cx-form__actions">
              <button type="button" class="cx-btn" @click="cancel">Discard</button>
              <button type="submit" class="cx-btn cx-btn--primary">Apply</button>
            </div>
          </form>
        </template>
      </AssetMap>

      <!-- 3d. Our context menu, from the event the map has always emitted. -->
      <div v-if="menu" class="cx-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }">
        <strong>{{ menuEntity?.label }}</strong>
        <button type="button" @click="inspect">Inspect</button>
        <button type="button" @click="centre">Centre on it</button>
        <button type="button" class="is-danger" @click="askDelete">Decommission</button>
      </div>

      <!-- 3e. Our confirmation. The package ships one; nothing forces its use. -->
      <div v-if="pendingDelete" class="cx-modal">
        <div class="cx-modal__box" role="alertdialog" aria-modal="true">
          <h3>Decommission {{ labelOf(pendingDelete) }}?</h3>
          <p>Its cabling is removed with it. This demo has no undo.</p>
          <div class="cx-modal__actions">
            <button type="button" class="cx-btn" @click="pendingDelete = undefined">Keep it</button>
            <button type="button" class="cx-btn cx-btn--danger" @click="confirmDelete">Decommission</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cx {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
}

/* 5. Theme tokens are plain custom properties on `.vam-root`, so the map is
   restyled from outside without touching the package. */
.cx :deep(.vam-root) {
  --vam-window-width: 320px;
  --vam-window-radius: 4px;
  --vam-window-border: #46506b;
  --vam-surface: var(--vp-c-bg);
  --vam-surface-sunken: var(--vp-c-bg-soft);
  --vam-fg: var(--vp-c-text-1);
  --vam-fg-subtle: var(--vp-c-text-2);
  --vam-fg-muted: var(--vp-c-text-3);
  --vam-bg: transparent;
  --vam-canvas-dot: transparent;
  --vam-font: 'IBM Plex Mono', ui-monospace, monospace;
  --vam-accent: #3a7ce0;
}

.cx-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.cx-bar__brand {
  padding: 2px 8px;
  border-radius: 3px;
  background: #3a7ce0;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.cx-bar__spacer {
  flex: 1 1 auto;
}

.cx-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 3px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
}

.cx-search input {
  width: 210px;
  border: 0;
  background: transparent;
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 11px;
  outline: none;
}

.cx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cx-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.cx-chip.is-on {
  border-color: #3a7ce0;
  background: color-mix(in srgb, #3a7ce0 14%, transparent);
  color: var(--vp-c-text-1);
}

/* The chip glyph repeats the node's shape, so the filter says which shape it
   selects rather than only naming it. */
.cx-chip__glyph {
  width: 9px;
  height: 9px;
  background: currentColor;
}

.cx-glyph--pill {
  border-radius: 999px;
}

.cx-glyph--squircle {
  border-radius: 3px;
}

.cx-glyph--diamond {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.cx-glyph--hexagon {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

.cx-glyph--octagon {
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
}

.cx-btn,
.cx-select {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 3px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.cx-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cx-btn--primary {
  border-color: #3a7ce0;
  background: #3a7ce0;
  color: #fff;
}

.cx-btn--danger {
  border-color: #d05353;
  background: #d05353;
  color: #fff;
}

.cx-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background-image:
    linear-gradient(var(--vp-c-divider) 1px, transparent 1px),
    linear-gradient(90deg, var(--vp-c-divider) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.999; /* new stacking context, so the grid stays under the canvas */
}

.cx-map {
  width: 100%;
  height: 100%;
}

.cx-legend {
  top: 12px;
  left: 12px;
}

.cx-legend__rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
}

.cx-legend__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cx-legend__line {
  width: 28px;
  height: 6px;
}

.cx-win__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
}

.cx-win__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9aa7bd;
}

.cx-win__dot--online {
  background: #3fa564;
}

.cx-win__dot--offline {
  background: #d05353;
}

.cx-win__dot--degraded {
  background: #d9822b;
}

.cx-tabs {
  display: flex;
  gap: 2px;
}

.cx-tabs button {
  flex: 1 1 auto;
  padding: 5px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--vp-c-text-3);
  font: inherit;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.cx-tabs button.is-on {
  border-bottom-color: #3a7ce0;
  color: var(--vp-c-text-1);
}

.cx-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}

.cx-body__empty {
  margin: 0;
  color: var(--vp-c-text-3);
}

.cx-facts {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 4px 10px;
  margin: 0;
}

.cx-facts dt {
  color: var(--vp-c-text-3);
}

.cx-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.cx-wire {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cx-wire i {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.cx-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 11px;
}

.cx-form label {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cx-form label span {
  color: var(--vp-c-text-3);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cx-form input,
.cx-form select {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 3px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 11px;
}

.cx-form__actions,
.cx-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.cx-menu {
  position: absolute;
  z-index: 70;
  display: flex;
  flex-direction: column;
  min-width: 168px;
  padding: 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
}

.cx-menu strong {
  padding: 2px 8px 6px;
  color: var(--vp-c-text-3);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cx-menu button {
  padding: 6px 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.cx-menu button:hover {
  background: var(--vp-c-bg-soft);
}

.cx-menu button.is-danger {
  color: #d05353;
}

.cx-modal {
  position: absolute;
  z-index: 90;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(10 14 24 / 55%);
}

.cx-modal__box {
  width: 320px;
  max-width: calc(100% - 32px);
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
}

.cx-modal__box h3 {
  margin: 0 0 6px;
  font-size: 13px;
}

.cx-modal__box p {
  margin: 0 0 14px;
  color: var(--vp-c-text-3);
  font-size: 11px;
}
</style>
