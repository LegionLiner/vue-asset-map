<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext, type ArrowDirection } from '../../composables/useMapContext'
import type { NetworkNodeData } from '../../composables/useFlowElements'

/**
 * Базовый узел карты.
 *
 * Взаимодействия уходят в контекст карты, а не в события VueFlow: так поведение
 * не зависит от того, включено ли у VueFlow собственное выделение, и одинаково
 * работает для мыши и клавиатуры.
 */
const props = defineProps<{
  id: string
  data?: NetworkNodeData
}>()

const map = useMapContext()
const element = ref<HTMLElement>()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))

const sublabels = computed(() => {
  if (!map.showSublabels.value || map.simplified.value) return []
  return entity.value?.sublabels ?? []
})

const badges = computed(() => (map.simplified.value ? [] : (entity.value?.badges ?? [])))

const statusColor = computed(() => map.statusColorOf(entity.value?.status))
const icon = computed(() => (entity.value ? map.iconFor(entity.value.kind) : undefined))

/** Слот `#node-{kind}` подменяет содержимое узла целиком. */
const kindSlot = computed(() => {
  const kind = entity.value?.kind
  if (!kind) return undefined
  return map.slots[`node-${kind}`]
})

const badgeSlot = computed(() => map.slots['node-badge'])

const classes = computed(() => [
  'vnm-node',
  `vnm-node--kind-${entity.value?.kind ?? 'unknown'}`,
  {
    'vnm-node--selected': map.isSelected(props.id),
    'vnm-node--matched': map.isMatched(props.id),
    'vnm-node--dimmed': map.isDimmed(props.id),
    'vnm-node--highlighted': map.isHighlighted(props.id),
    'vnm-node--simplified': map.simplified.value,
  },
])

const ariaLabel = computed(() => {
  const label = entity.value?.label ?? props.id
  const status = entity.value?.status
  return status ? `${label}. ${map.t('node.status', { status })}` : label
})

const arrowKeys: Readonly<Record<string, ArrowDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    // Клавиатура повторяет клик, включая аддитивное выделение по Ctrl/Meta.
    map.onNodeClick(props.id, new MouseEvent('click', { ctrlKey: event.ctrlKey, metaKey: event.metaKey }))
    return
  }

  const direction = arrowKeys[event.key]
  if (direction) {
    event.preventDefault()
    map.onArrowNavigate(props.id, direction)
  }
}

watch(element, (next) => map.registerNodeElement(props.id, next), { immediate: true })
onBeforeUnmount(() => map.registerNodeElement(props.id, undefined))
</script>

<template>
  <div
    ref="element"
    :class="classes"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-pressed="map.isSelected(id)"
    @click="map.onNodeClick(id, $event)"
    @dblclick="map.onNodeDoubleClick(id, $event)"
    @contextmenu="map.onNodeContextMenu(id, $event)"
    @keydown="onKeydown"
  >
    <!-- Хэндлы в центре узла: рёбра карты идут от центра к центру, иначе в
         радиальной раскладке линии выходили бы из одного и того же края. -->
    <Handle type="target" :position="Position.Top" class="vnm-node__handle" />
    <Handle type="source" :position="Position.Bottom" class="vnm-node__handle" />

    <component
      :is="kindSlot"
      v-if="kindSlot"
      :entity="entity"
      :node-id="id"
      :simplified="map.simplified.value"
    />

    <template v-else>
      <span class="vnm-node__icon" aria-hidden="true">
        <component :is="icon" v-if="icon" />
        <span v-else class="vnm-node__icon-fallback">{{ (entity?.kind ?? '?').slice(0, 2) }}</span>
      </span>

      <span class="vnm-node__body">
        <span class="vnm-node__label">{{ entity?.label ?? id }}</span>

        <span v-if="sublabels.length > 0" class="vnm-node__sublabels">
          <span v-for="(sublabel, index) in sublabels" :key="sublabel" class="vnm-node__sublabel">
            <!-- Первая подпись — внешний адрес, остальные считаются оверлейными:
                 в логическом виде их надо различать глазами. -->
            <span :class="index === 0 ? 'vnm-node__sublabel-primary' : 'vnm-node__sublabel-overlay'">
              {{ sublabel }}
            </span>
          </span>
        </span>
      </span>

      <span
        v-if="entity?.status"
        class="vnm-node__status"
        :style="statusColor ? { backgroundColor: statusColor } : undefined"
        :title="map.t('node.status', { status: entity.status })"
      />

      <span
        v-if="badges.length > 0"
        class="vnm-node__badges"
        :aria-label="map.t('node.badges', { count: badges.length })"
      >
        <template v-for="badge in badges" :key="badge.id">
          <component :is="badgeSlot" v-if="badgeSlot" :badge="badge" :entity="entity" />
          <span
            v-else
            class="vnm-node__badge"
            :style="badge.color ? { backgroundColor: badge.color } : undefined"
            :title="badge.tooltip"
          >
            {{ badge.id }}
          </span>
        </template>
      </span>
    </template>
  </div>
</template>

<style>
.vnm-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--vnm-space-2);
  box-sizing: border-box;
  width: var(--vnm-node-width);
  padding: var(--vnm-node-padding);
  border: 1px solid var(--vnm-border);
  border-radius: var(--vnm-node-radius);
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-sm);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size);
  line-height: var(--vnm-line-height);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--vnm-transition),
    box-shadow var(--vnm-transition),
    opacity var(--vnm-transition);
}

.vnm-node:hover {
  border-color: var(--vnm-border-strong);
  box-shadow: var(--vnm-shadow-md);
}

/* Видимый focus-ring, а не только :hover — узлы обходятся с клавиатуры. */
.vnm-node:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 2px;
}

.vnm-node--selected {
  border-color: var(--vnm-accent);
  box-shadow:
    var(--vnm-shadow-md),
    0 0 0 2px var(--vnm-selection);
}

.vnm-node--matched {
  border-color: var(--vnm-highlight);
  box-shadow:
    var(--vnm-shadow-md),
    0 0 0 3px var(--vnm-highlight-soft);
}

.vnm-node--highlighted {
  border-color: var(--vnm-edge-active);
  box-shadow:
    var(--vnm-shadow-md),
    0 0 0 3px var(--vnm-accent-soft);
}

.vnm-node--dimmed {
  opacity: var(--vnm-dimmed-opacity);
}

/* LOD: на мелком масштабе остаётся иконка и цветовой индикатор. */
.vnm-node--simplified {
  width: var(--vnm-node-size);
  height: var(--vnm-node-size);
  justify-content: center;
  padding: var(--vnm-space-1);
}

.vnm-node--simplified .vnm-node__body {
  display: none;
}

.vnm-node__handle {
  top: 50%;
  left: 50%;
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  border: 0;
  background: transparent;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.vnm-node__icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-surface-sunken);
  color: var(--vnm-fg-muted);
}

.vnm-node__icon-fallback {
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  text-transform: uppercase;
}

.vnm-node__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.vnm-node__label {
  overflow: hidden;
  font-weight: var(--vnm-font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-node__sublabels {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-family: var(--vnm-font-mono);
  font-size: var(--vnm-font-size-sm);
}

.vnm-node__sublabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-node__sublabel-primary {
  color: var(--vnm-fg-muted);
}

.vnm-node__sublabel-overlay {
  color: var(--vnm-accent);
}

.vnm-node__status {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--vnm-surface);
  border-radius: 50%;
  background: var(--vnm-status-unknown);
}

.vnm-node__badges {
  position: absolute;
  bottom: -8px;
  left: var(--vnm-node-padding);
  display: flex;
  gap: var(--vnm-space-1);
}

.vnm-node__badge {
  padding: 0 var(--vnm-space-1);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-accent-soft);
  color: var(--vnm-fg);
  font-size: var(--vnm-font-size-sm);
  line-height: 14px;
}
</style>
