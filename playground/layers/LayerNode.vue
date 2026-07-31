<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetNodeData } from 'vue-asset-map'
import { descendantsOf } from 'vue-asset-map/core'
import { useLayers } from './context'
import { inHandle, outHandle, type LayerMeta } from './types'

/**
 * Слой: прямоугольный блок, внутри которого лежат объекты.
 *
 * Совсем другая модель узла, чем у круга по умолчанию, и поэтому это компонент
 * из `nodeTypes`, а не слот: слот подменяет содержимое круга, а здесь круга нет
 * вовсе. Пакету слой — обычная сущность; объекты живут в `meta` и existуют
 * только для этого приложения.
 *
 * Каждый объект несёт две ручки VueFlow — нижнюю и верхнюю. Именно они делают
 * линии связями между **объектами**, а не между слоями: id ручек уезжают в
 * `link.sourceHandle` / `link.targetHandle`, и карта рисует линию от нужного
 * объекта к нужному, а не от блока к блоку.
 */
const props = defineProps<{
  id: string
  data?: AssetNodeData<LayerMeta>
  connectable?: boolean
}>()

const map = useMapContext()
const layers = useLayers()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))
const objects = computed(() => entity.value?.meta?.objects ?? [])

const selected = computed(() => map.isSelected(props.id))

/**
 * Кнопка сокрытия появляется только после четвёртого потомка.
 *
 * Считаются именно потомки, а не прямые дети: смысл кнопки — «убрать с глаз
 * ветку целиком», и ветка из трёх узлов на двух уровнях ничем не лучше ветки из
 * трёх на одном.
 */
const descendantCount = computed(() => descendantsOf(map.graph.value, props.id).length)
const canCollapse = computed(() => descendantCount.value > 3)
const collapsed = computed(() => map.isSubtreeCollapsed(props.id))

function onAdd(event: MouseEvent): void {
  // Иначе клик дойдёт до слоя и заодно его выделит.
  event.stopPropagation()
  layers.addObject(props.id)
}

function onToggle(event: MouseEvent): void {
  event.stopPropagation()
  map.onToggleSubtree(props.id)
}
</script>

<template>
  <div class="layer" :class="{ 'is-selected': selected }" @click="map.onNodeClick(id, $event)">
    <!-- Название и кнопки — снаружи блока, над ним. -->
    <div class="layer__bar">
      <span class="layer__name">{{ entity?.label ?? id }}</span>

      <span class="layer__actions">
        <button
          v-if="canCollapse"
          type="button"
          class="layer__icon"
          :title="collapsed ? 'Показать дочерние' : 'Скрыть дочерние'"
          :aria-label="collapsed ? 'Показать дочерние' : 'Скрыть дочерние'"
          @click="onToggle"
        >
          {{ collapsed ? '▸' : '▾' }}
        </button>

        <button
          type="button"
          class="layer__icon"
          title="Добавить объект"
          aria-label="Добавить объект"
          @click="onAdd"
        >
          +
        </button>
      </span>
    </div>

    <div class="layer__box">
      <span v-if="objects.length === 0" class="layer__empty">Пустой слой</span>

      <div v-for="object in objects" :key="object.id" class="layer__object">
        {{ object.label }}

        <!-- Две ручки на объект: линия всегда уходит вниз и приходит сверху,
             поэтому исходящая сидит на нижней грани, а входящая на верхней. -->
        <Handle
          :id="inHandle(object.id)"
          type="target"
          :position="Position.Top"
          class="layer__port layer__port--in"
          :connectable="connectable"
        />
        <Handle
          :id="outHandle(object.id)"
          type="source"
          :position="Position.Bottom"
          class="layer__port layer__port--out"
          :connectable="connectable"
        />
      </div>
    </div>
  </div>
</template>

<style>
.layer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  font-family: 'Nunito Sans', system-ui, sans-serif;
  cursor: pointer;
}

.layer__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 160px;
}

.layer__name {
  color: var(--fg-subtle, #4d6d9a);
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.layer__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.layer__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--fg-subtle, #4d6d9a);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.layer__icon:hover {
  background: rgb(77 109 154 / 12%);
}

.layer__box {
  display: flex;
  padding: 16px;
  align-items: flex-start;
  gap: 10px;
  min-width: 160px;
  min-height: 56px;
  border: 1px solid var(--fg-muted, #7c92b2);
  border-radius: 8px;
  background: var(--disabled, #dee4ed);
}

/* Пустой слой подписывает себя сам, по центру блока. */
.layer__box:has(.layer__empty) {
  align-items: center;
  justify-content: center;
}

.layer.is-selected .layer__box {
  border-color: var(--fg-subtle, #4d6d9a);
}

.layer__empty {
  color: var(--fg-muted, #7c92b2);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.layer__object {
  position: relative;
  display: flex;
  padding: 10px 16px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  background: var(--fg-brand-ghost, rgb(77 109 154 / 10%));
  color: var(--fg-subtle, #4d6d9a);
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  white-space: nowrap;
}

/*
 * Порты объекта. Спрятаны, пока на слой не навели: по два кружка на объект в
 * покое — это лес точек на карте, где слоёв десяток.
 */
.layer__port {
  position: absolute !important;
  z-index: 2;
  left: 50% !important;
  width: 9px !important;
  height: 9px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: 2px solid #fff !important;
  border-radius: 50%;
  background: var(--fg-subtle, #4d6d9a) !important;
  opacity: 0;
  cursor: crosshair;
  transform: translateX(-50%);
  transition: opacity 120ms ease;
  pointer-events: all !important;
}

.layer:hover .layer__port {
  opacity: 1;
}

.layer__port--in {
  top: -5px !important;
}

.layer__port--out {
  top: auto !important;
  bottom: -5px !important;
}
</style>
