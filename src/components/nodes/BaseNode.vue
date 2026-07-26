<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext, type ArrowDirection } from '../../composables/useMapContext'
import type { AssetNodeData } from '../../composables/useFlowElements'
import { IconExpand } from '../icons/index'

/**
 * The default map node: a circle with an icon and a label plate beneath it.
 *
 * Circle size follows the node's level — root entities are drawn larger than
 * children, which is the only visual cue for depth; there is no field for it in
 * the data.
 *
 * Interactions go to the map context rather than to VueFlow events, so behaviour
 * does not depend on whether VueFlow's own selection is enabled and works the
 * same for mouse and keyboard.
 *
 * Every part of it can be dropped or replaced without writing a node component:
 * `showNodeStatus`, `showNodeToggle` and `showNodeLabel` remove the status dot,
 * the fold button and the label plate; `#node-{type}` swaps the circle's
 * contents, `#node-status` the dot and `#node-label` the whole plate. A design
 * that shares none of this structure is a `nodeTypes` entry instead.
 */
const props = defineProps<{
  id: string
  data?: AssetNodeData
}>()

const map = useMapContext()
const element = ref<HTMLElement>()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))

const isRoot = computed(() => map.isRootNode(props.id))

const hasChildren = computed(() => map.hasChildren(props.id) && map.showNodeToggle.value)
const subtreeCollapsed = computed(() => map.isSubtreeCollapsed(props.id))

const sublabels = computed(() => map.sublabelsOf(props.id))

const badges = computed(() => (map.simplified.value ? [] : (entity.value?.badges ?? [])))

const statusColor = computed(() => map.statusColorOf(entity.value?.status))

/** The status dot: present only while the entity has one and it is not switched off. */
const status = computed(() => (map.showNodeStatus.value ? entity.value?.status : undefined))

/** The label plate: dropped by `showNodeLabel`, and by the LOD level. */
const showLabel = computed(() => map.showNodeLabel.value && !map.simplified.value)

const markers = computed(() => map.markersFor(props.id))

/**
 * On an infected node the dots take the infection color whatever their own is:
 * membership matters, but capture matters more, and the dots must not argue
 * with the rest of the node's coloring.
 */
function markerColor(marker: { color: string }): string {
  return map.isInfected(props.id) ? 'var(--vam-marker-infected)' : marker.color
}
const icon = computed(() => (entity.value ? map.iconFor(entity.value.type) : undefined))

/** `#node-{type}` replaces the contents of the circle. */
const kindSlot = computed(() => {
  const type = entity.value?.type
  return type ? map.slot(`node-${type}`) : undefined
})

const badgeSlot = computed(() => map.slot('node-badge'))

/** `#node-label` replaces the whole plate; `#node-status` replaces the dot. */
const labelSlot = computed(() => map.slot('node-label'))
const statusSlot = computed(() => map.slot('node-status'))

/**
 * What every `node-*` slot receives.
 *
 * Bound as one object rather than attribute by attribute: a template writes
 * `:node-id`, and a slot function is invoked as a functional component with no
 * declared props, so it receives the raw attribute names — the `nodeId` the
 * public `NodeSlotProps` promises would arrive as `node-id` and read as
 * `undefined`. `v-bind` of an object keeps the keys exactly as written here.
 */
const slotProps = computed(() => ({
  entity: entity.value,
  nodeId: props.id,
  simplified: map.simplified.value,
}))

const selected = computed(() => map.isSelected(props.id))

const classes = computed(() => [
  'vam-node',
  `vam-node--type-${entity.value?.type ?? 'unknown'}`,
  isRoot.value ? 'vam-node--root' : 'vam-node--child',
  {
    'vam-node--selected': selected.value,
    'vam-node--matched': map.isMatched(props.id),
    'vam-node--dimmed': map.isDimmed(props.id),
    'vam-node--highlighted': map.isHighlighted(props.id),
    'vam-node--simplified': map.simplified.value,
    'vam-node--infected': map.isInfected(props.id),
    'vam-node--infection-source': map.isInfectionSource(props.id),
  },
])

const ariaLabel = computed(() => {
  const label = entity.value?.label ?? props.id
  const status = entity.value?.status
  return status ? `${label}. ${map.t('node.status', { status })}` : label
})

const toggleLabel = computed(() => (subtreeCollapsed.value ? map.t('group.expand') : map.t('group.collapse')))

const arrowKeys: Readonly<Record<string, ArrowDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    // The keyboard mirrors a click, additive selection included.
    map.onNodeClick(
      props.id,
      new MouseEvent('click', { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey }),
    )
    return
  }

  const direction = arrowKeys[event.key]
  if (direction) {
    event.preventDefault()
    map.onArrowNavigate(props.id, direction)
  }
}

function onToggle(event: MouseEvent): void {
  // Pressing the button must not select the node as well.
  event.stopPropagation()
  map.onToggleSubtree(props.id)
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
    :aria-pressed="selected"
    @click="map.onNodeClick(id, $event)"
    @dblclick="map.onNodeDoubleClick(id, $event)"
    @contextmenu="map.onNodeContextMenu(id, $event)"
    @keydown="onKeydown"
  >
    <!-- Handles sit at the centre of the circle: edges run centre to centre, or
         a radial layout would have every line leave from the same edge. -->
    <Handle type="target" :position="Position.Top" class="vam-node__handle" />
    <Handle type="source" :position="Position.Bottom" class="vam-node__handle" />

    <div class="vam-node__circle">
      <component :is="kindSlot" v-if="kindSlot" v-bind="slotProps" />
      <template v-else>
        <component :is="icon" v-if="icon" class="vam-node__icon" />
        <span v-else class="vam-node__initials" aria-hidden="true">
          {{ (entity?.type ?? '?').slice(0, 2) }}
        </span>
      </template>

      <template v-if="status">
        <component :is="statusSlot" v-if="statusSlot" v-bind="{ ...slotProps, status, statusColor }" />
        <span
          v-else
          class="vam-node__status"
          :style="statusColor ? { backgroundColor: statusColor } : undefined"
          :title="map.t('node.status', { status })"
        />
      </template>

      <button
        v-if="hasChildren"
        type="button"
        class="vam-node__toggle"
        :aria-label="toggleLabel"
        :aria-expanded="!subtreeCollapsed"
        :title="toggleLabel"
        @click="onToggle"
      >
        <IconExpand />
      </button>
    </div>

    <template v-if="showLabel">
      <component :is="labelSlot" v-if="labelSlot" v-bind="{ ...slotProps, sublabels }" />
      <div v-else class="vam-node__info">
        <span class="vam-node__label">{{ entity?.label ?? id }}</span>
        <span
          v-for="(sublabel, index) in sublabels"
          :key="sublabel"
          :class="index === 0 ? 'vam-node__sublabel' : 'vam-node__sublabel-overlay'"
        >
          {{ sublabel }}
        </span>
      </div>
    </template>

    <span v-if="markers.length > 0 && !map.simplified.value" class="vam-node__markers">
      <button
        v-for="marker in markers"
        :key="marker.id"
        type="button"
        class="vam-node__marker"
        :aria-label="map.t('marker.membership', { label: marker.label })"
        :title="marker.label"
        @mouseenter="map.onMarkerEnter(marker.id)"
        @mouseleave="map.onMarkerLeave()"
        @focus="map.onMarkerFocus(marker.id)"
        @blur="map.onMarkerLeave()"
        @click.stop
      >
        <span class="vam-node__marker-dot" :style="{ backgroundColor: markerColor(marker) }" />
      </button>
    </span>

    <span
      v-if="!map.simplified.value && badges.length > 0"
      class="vam-node__badges"
      :aria-label="map.t('node.badges', { count: badges.length })"
    >
      <template v-for="badge in badges" :key="badge.id">
        <component :is="badgeSlot" v-if="badgeSlot" v-bind="{ ...slotProps, badge }" />
        <span
          v-else
          class="vam-node__badge"
          :style="badge.color ? { backgroundColor: badge.color } : undefined"
          :title="badge.tooltip"
        >
          {{ badge.id }}
        </span>
      </template>
    </span>
  </div>
</template>

<style>
.vam-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--vam-node-label-gap);
  width: var(--vam-node-label-width);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size-sm);
  line-height: var(--vam-line-height-sm);
  text-align: center;
  cursor: pointer;
  transition: opacity var(--vam-transition);
}

/* The circle and the label plate are outlined separately rather than as one
   rectangle around the node: there is empty space between them, and a shared
   frame would enclose that space too. */
.vam-node:focus-visible {
  outline: none;
}

.vam-node:focus-visible .vam-node__circle,
.vam-node:focus-visible .vam-node__info {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 2px;
}

.vam-node--selected .vam-node__circle,
.vam-node--selected .vam-node__info {
  border-color: var(--vam-selection);
}

.vam-node--matched .vam-node__circle,
.vam-node--matched .vam-node__info {
  border-color: var(--vam-highlight);
}

.vam-node--highlighted .vam-node__circle,
.vam-node--highlighted .vam-node__info {
  border-color: var(--vam-edge-active);
}

.vam-node--dimmed {
  opacity: var(--vam-dimmed-opacity);
}

/* Placed after the selection states on purpose: being captured outranks being
   selected, so infection wins the cascade. */
.vam-node--infected .vam-node__circle {
  border-color: var(--vam-infected-border);
  background: var(--vam-infected-bg);
  color: var(--vam-infected-fg);
}

.vam-node--infected .vam-node__info {
  border-color: var(--vam-infected-border);
  background: var(--vam-infected-bg);
}

/* A hand-marked source is drawn heavier than the nodes it captured. */
.vam-node--infection-source .vam-node__circle {
  border-width: 2px;
}

.vam-node__circle {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--vam-node-size);
  height: var(--vam-node-size);
  border: 1px solid var(--vam-border);
  border-radius: 50%;
  background: var(--vam-surface);
  box-shadow: var(--vam-shadow-sm);
  color: var(--vam-fg-muted);
}

.vam-node--root .vam-node__circle {
  width: var(--vam-node-size-root);
  height: var(--vam-node-size-root);
}

.vam-node:hover .vam-node__circle {
  border-color: var(--vam-border-strong);
}

.vam-node__icon {
  width: 55%;
  height: 55%;
}

.vam-node__initials {
  font-size: var(--vam-font-size-sm);
  font-weight: var(--vam-font-weight-bold);
  text-transform: uppercase;
}

.vam-node__handle {
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

.vam-node__status {
  position: absolute;
  top: 0;
  right: 0;
  box-sizing: border-box;
  width: var(--vam-node-status-size);
  height: var(--vam-node-status-size);
  border: 1px solid var(--vam-surface);
  border-radius: 50%;
  background: var(--vam-status-unknown);
}

.vam-node__toggle {
  position: absolute;
  top: calc(var(--vam-node-toggle-size) / -3);
  right: calc(var(--vam-node-toggle-size) / -3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--vam-node-toggle-size);
  height: var(--vam-node-toggle-size);
  padding: 0;
  border: 1px solid var(--vam-border);
  border-radius: 50%;
  background: var(--vam-surface);
  color: var(--vam-fg-subtle);
  cursor: pointer;
}

/* On root nodes the status dot and the toggle must not overlap. */
.vam-node--root .vam-node__status {
  top: 2px;
  right: 2px;
}

.vam-node__toggle:hover {
  border-color: var(--vam-border-strong);
  background: var(--vam-surface-sunken);
}

.vam-node__toggle:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-node__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--vam-node-label-width);
  height: var(--vam-node-label-height);
  padding: var(--vam-node-label-padding);
  /* Always present but transparent, so selecting a node cannot shift its
     contents by a pixel. */
  border: 1px solid transparent;
  border-radius: var(--vam-node-label-radius);
  background: var(--vam-surface);
  overflow: hidden;
  transition: border-color var(--vam-transition);
}

.vam-node__label {
  max-width: 100%;
  overflow: hidden;
  color: var(--vam-node-label-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vam-node__sublabel,
.vam-node__sublabel-overlay {
  max-width: 100%;
  overflow: hidden;
  line-height: var(--vam-node-sublabel-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vam-node__sublabel {
  color: var(--vam-node-sublabel-color);
}

/* The overlay address differs from the external one by color: in the logical
   view that is the only way to tell them apart at a glance. */
.vam-node__sublabel-overlay {
  color: var(--vam-node-overlay-color);
}

.vam-node__markers {
  display: flex;
  justify-content: center;
  gap: var(--vam-marker-gap);
  /* Spacing lives here rather than in the container's gap: the plate and the
     badges have their own distances, and one shared gap would break both. */
  margin-top: calc(var(--vam-marker-offset) - var(--vam-node-label-gap));
}

.vam-node__marker {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--vam-marker-size);
  height: var(--vam-marker-size);
  padding: 0;
  border: 0;
  border-radius: 50%;
  /* Opaque backing, so a dot reads both over the plate and over the canvas. */
  background: var(--vam-marker-bg);
  cursor: pointer;
}

.vam-node__marker:focus-visible {
  outline: 2px solid var(--vam-focus-ring);
  outline-offset: 1px;
}

.vam-node__marker-dot {
  width: var(--vam-marker-dot-size);
  height: var(--vam-marker-dot-size);
  border-radius: 50%;
  background: var(--vam-marker-1);
}

/* Badges go under the plate, not inside it: inside there is room for exactly
   three lines. */
.vam-node__badges {
  display: flex;
  justify-content: center;
  gap: var(--vam-space-1);
}

.vam-node__badge {
  padding: 0 var(--vam-space-1);
  border-radius: var(--vam-radius-sm);
  background: var(--vam-accent-soft);
  color: var(--vam-fg-subtle);
  font-size: var(--vam-font-size-sm);
  line-height: 14px;
}

/* LOD: below the zoom threshold only the circle with its icon remains. */
.vam-node--simplified {
  width: auto;
  gap: 0;
}
</style>
