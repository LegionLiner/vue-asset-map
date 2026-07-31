<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { AssetMap } from 'vue-asset-map'
import type { AssetMapExposed, ThemeMode } from 'vue-asset-map'
import LayerNode from './LayerNode.vue'
import { provideLayers } from './context'
import { objectOfHandle, type LayerEntity, type LayerLink } from './types'

/**
 * Второй вариант карты: слои с объектами внутри.
 *
 * Слой — обычная сущность пакета, отрисованная своим компонентом; объекты живут
 * в `meta` и пакету неизвестны. Связи идут между **объектами**, а не слоями:
 * каждый объект несёт пару ручек, и их id уезжают в `sourceHandle` /
 * `targetHandle` связи.
 *
 * Иерархию слоёв приложение выводит из этих же связей: верхний слой становится
 * родителем нижнего. Только поэтому работает встроенная свёртка поддерева —
 * пакет ничего не знает про объекты, но `parentId` понимает прекрасно.
 */
defineProps<{ theme: ThemeMode }>()

const map = useTemplateRef<AssetMapExposed>('map')

let nextId = 3

const entities = ref<LayerEntity[]>([
  { id: 'layer-1', type: 'layer', label: 'Ядро сети', meta: { objects: [] } },
  { id: 'layer-2', type: 'layer', label: 'Распределение', meta: { objects: [] } },
])

const links = ref<LayerLink[]>([])

const selection = ref<string[]>([])
const collapsedNodes = ref(new Set<string>())

/*
 * Родство выводится из связей: слой с исходящей связью — родитель того, к чьему
 * объекту она пришла. Пакету отдаётся уже с `parentId`, и его свёртка поддерева
 * начинает работать, ничего не зная об объектах.
 */
const parentOf = computed(() => {
  const parents = new Map<string, string>()
  for (const link of links.value) {
    // Первый найденный родитель и остаётся: иначе цепочка родства зависела бы
    // от порядка связей, а с двумя родителями `ancestorsOf` пошёл бы по кругу.
    if (!parents.has(link.target) && link.target !== link.source) {
      parents.set(link.target, link.source)
    }
  }
  return parents
})

/** Слои по уровням: связи всегда идут сверху вниз, значит и раскладка тоже. */
const positioned = computed<LayerEntity[]>(() => {
  const depth = new Map<string, number>()

  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id) as number
    if (seen.has(id)) return 0
    seen.add(id)

    const parent = parentOf.value.get(id)
    const value = parent ? depthOf(parent, seen) + 1 : 0
    depth.set(id, value)
    return value
  }

  const row = new Map<number, number>()

  return entities.value.map((entity) => {
    const level = depthOf(entity.id)
    const column = row.get(level) ?? 0
    row.set(level, column + 1)

    return {
      ...entity,
      parentId: parentOf.value.get(entity.id) ?? null,
      position: { x: column * 320, y: level * 200 },
    }
  })
})

const nodeTypes = { layer: LayerNode }

/* ----------------------------------------------------- создание объекта -- */

const objectDraft = ref<{ layerId: string; label: string } | undefined>()
const objectInput = useTemplateRef<HTMLInputElement>('objectInput')

provideLayers({
  addObject: (layerId) => {
    objectDraft.value = { layerId, label: '' }
    void nextTick(() => objectInput.value?.focus())
  },
})

function submitObject(): void {
  const draft = objectDraft.value
  const label = draft?.label.trim()
  if (!draft || !label) return

  const id = `obj-${nextId++}`
  entities.value = entities.value.map((entity) =>
    entity.id === draft.layerId
      ? { ...entity, meta: { objects: [...(entity.meta?.objects ?? []), { id, label }] } }
      : entity,
  )

  objectDraft.value = undefined
}

/* ------------------------------------------------------- создание слоя -- */

function addLayer(): void {
  const index = entities.value.length + 1
  entities.value = [
    ...entities.value,
    { id: `layer-${nextId++}`, type: 'layer', label: `Слой ${index}`, meta: { objects: [] } },
  ]
}

/* -------------------------------------------------------------- связи -- */

/**
 * Соединение доведено до конца.
 *
 * Карта уже положила в кандидата id обеих ручек — остаётся проверить, что
 * соединяют именно объекты и что такой линии ещё нет.
 */
function onLinkCreate({ link }: { link: LayerLink }): void {
  const from = objectOfHandle(link.sourceHandle)
  const to = objectOfHandle(link.targetHandle)
  if (!from || !to || from === to) return

  const exists = links.value.some(
    (candidate) =>
      candidate.sourceHandle === link.sourceHandle && candidate.targetHandle === link.targetHandle,
  )
  if (exists) return

  links.value = [...links.value, { ...link, layers: [] }]
}

function onLinkDelete({ id }: { id: string }): void {
  links.value = links.value.filter((link) => link.id !== id)
}

const linkCount = computed(() => links.value.length)
const objectCount = computed(() =>
  entities.value.reduce((total, entity) => total + (entity.meta?.objects?.length ?? 0), 0),
)
</script>

<template>
  <div class="lay">
    <div class="lay-bar">
      <span class="lay-bar__title">Вариант 2 · слои и объекты</span>
      <button type="button" @click="addLayer">Добавить слой</button>
      <button type="button" @click="map?.fitView()">Вся карта</button>
      <span class="lay-bar__hint">
        Слоёв: {{ entities.length }} · объектов: {{ objectCount }} · связей: {{ linkCount }} · тяните от
        нижней точки объекта к верхней точке другого · правый клик по линии — удалить
      </span>
    </div>

    <AssetMap
      ref="map"
      v-model:selection="selection"
      v-model:collapsed-nodes="collapsedNodes"
      class="lay-map"
      :entities="positioned"
      :links="links"
      :node-types="nodeTypes"
      :theme="theme"
      :layout="{ engine: 'manual' }"
      :collapse="false"
      :show-details-panel="false"
      :show-toolbar="false"
      show-context-menu
      editable
      auto-fit-view
      @link-create="onLinkCreate"
      @link-delete="onLinkDelete"
    />

    <div
      v-if="objectDraft"
      class="lay-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Добавить объект"
      @pointerdown.self="objectDraft = undefined"
    >
      <form class="lay-modal__box" @submit.prevent="submitObject">
        <strong>Новый объект</strong>
        <label>
          <span>Название</span>
          <input ref="objectInput" v-model="objectDraft.label" type="text" placeholder="Например, eth0" />
        </label>
        <div class="lay-modal__actions">
          <button type="button" @click="objectDraft = undefined">Отмена</button>
          <button type="submit" :disabled="objectDraft.label.trim().length === 0">Добавить</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style>
.lay {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  font-family: 'Nunito Sans', system-ui, sans-serif;
}

.lay-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #111827;
  color: #f9fafb;
  font-size: 13px;
}

.lay-bar__title {
  font-weight: 600;
}

.lay-bar__hint {
  color: #9ca3af;
}

.lay-bar button {
  padding: 5px 9px;
  border: 1px solid #374151;
  border-radius: 6px;
  background: #1f2937;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.lay-bar button:hover {
  border-color: #6b7280;
  background: #374151;
}

.lay-map {
  flex: 1 1 auto;
  min-height: 0;
}

.lay-modal {
  position: absolute;
  z-index: 100;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(27 38 54 / 45%);
}

.lay-modal__box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 320px;
  padding: 16px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 32px rgb(0 0 0 / 16%);
  color: #1b2636;
}

.lay-modal__box label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #4d6d9a;
  font-size: 12px;
}

.lay-modal__box input {
  padding: 6px 8px;
  border: 1px solid #dfe5ee;
  border-radius: 6px;
  color: #1b2636;
  font: inherit;
  font-size: 14px;
}

.lay-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.lay-modal__actions button {
  padding: 7px 14px;
  border: 1px solid #dfe5ee;
  border-radius: 6px;
  background: #fff;
  color: #1b2636;
  font: inherit;
  cursor: pointer;
}

.lay-modal__actions button[type='submit'] {
  border-color: #4d6d9a;
  background: #4d6d9a;
  color: #fff;
  font-weight: 700;
}

.lay-modal__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
