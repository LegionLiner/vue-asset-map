<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext, type ArrowDirection } from '../../composables/useMapContext'
import type { NetworkNodeData } from '../../composables/useFlowElements'
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
 */
const props = defineProps<{
  id: string
  data?: NetworkNodeData
}>()

const map = useMapContext()
const element = ref<HTMLElement>()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))

const isRoot = computed(() => map.isRootNode(props.id))

const hasChildren = computed(() => map.hasChildren(props.id))
const subtreeCollapsed = computed(() => map.isSubtreeCollapsed(props.id))

const sublabels = computed(() => {
  if (!map.showSublabels.value || map.simplified.value) return []
  return entity.value?.sublabels ?? []
})

const badges = computed(() => (map.simplified.value ? [] : (entity.value?.badges ?? [])))

const statusColor = computed(() => map.statusColorOf(entity.value?.status))

const markers = computed(() => map.markersFor(props.id))

/**
 * On an infected node the dots take the infection color whatever their own is:
 * membership matters, but capture matters more, and the dots must not argue
 * with the rest of the node's coloring.
 */
function markerColor(marker: { color: string }): string {
  return map.isInfected(props.id) ? 'var(--vnm-marker-infected)' : marker.color
}
const icon = computed(() => (entity.value ? map.iconFor(entity.value.kind) : undefined))

/** `#node-{kind}` replaces the contents of the circle. */
const kindSlot = computed(() => {
  const kind = entity.value?.kind
  return kind ? map.slot(`node-${kind}`) : undefined
})

const badgeSlot = computed(() => map.slot('node-badge'))

const selected = computed(() => map.isSelected(props.id))

const classes = computed(() => [
  'vnm-node',
  `vnm-node--kind-${entity.value?.kind ?? 'unknown'}`,
  isRoot.value ? 'vnm-node--root' : 'vnm-node--child',
  {
    'vnm-node--selected': selected.value,
    'vnm-node--matched': map.isMatched(props.id),
    'vnm-node--dimmed': map.isDimmed(props.id),
    'vnm-node--highlighted': map.isHighlighted(props.id),
    'vnm-node--simplified': map.simplified.value,
    'vnm-node--infected': map.isInfected(props.id),
    'vnm-node--infection-source': map.isInfectionSource(props.id),
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
    // The keyboard mirrors a click, additive selection on Ctrl/Meta included.
    map.onNodeClick(props.id, new MouseEvent('click', { ctrlKey: event.ctrlKey, metaKey: event.metaKey }))
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
    <Handle type="target" :position="Position.Top" class="vnm-node__handle" />
    <Handle type="source" :position="Position.Bottom" class="vnm-node__handle" />

    <div class="vnm-node__circle">
      <component
        :is="kindSlot"
        v-if="kindSlot"
        :entity="entity"
        :node-id="id"
        :simplified="map.simplified.value"
      />
      <template v-else>
        <component :is="icon" v-if="icon" class="vnm-node__icon" />
        <span v-else class="vnm-node__initials" aria-hidden="true">
          {{ (entity?.kind ?? '?').slice(0, 2) }}
        </span>
      </template>

      <span
        v-if="entity?.status"
        class="vnm-node__status"
        :style="statusColor ? { backgroundColor: statusColor } : undefined"
        :title="map.t('node.status', { status: entity.status })"
      />

      <button
        v-if="hasChildren"
        type="button"
        class="vnm-node__toggle"
        :aria-label="toggleLabel"
        :aria-expanded="!subtreeCollapsed"
        :title="toggleLabel"
        @click="onToggle"
      >
        <IconExpand />
      </button>
    </div>

    <div v-if="!map.simplified.value" class="vnm-node__info">
      <span class="vnm-node__label">{{ entity?.label ?? id }}</span>
      <span
        v-for="(sublabel, index) in sublabels"
        :key="sublabel"
        :class="index === 0 ? 'vnm-node__sublabel' : 'vnm-node__sublabel-overlay'"
      >
        {{ sublabel }}
      </span>
    </div>

    <span v-if="markers.length > 0 && !map.simplified.value" class="vnm-node__markers">
      <button
        v-for="marker in markers"
        :key="marker.id"
        type="button"
        class="vnm-node__marker"
        :aria-label="map.t('marker.membership', { label: marker.label })"
        :title="marker.label"
        @mouseenter="map.onMarkerEnter(marker.id)"
        @mouseleave="map.onMarkerLeave()"
        @focus="map.onMarkerFocus(marker.id)"
        @blur="map.onMarkerLeave()"
        @click.stop
      >
        <span class="vnm-node__marker-dot" :style="{ backgroundColor: markerColor(marker) }" />
      </button>
    </span>

    <span
      v-if="!map.simplified.value && badges.length > 0"
      class="vnm-node__badges"
      :aria-label="map.t('node.badges', { count: badges.length })"
    >
      <template v-for="badge in badges" :key="badge.id">
        <component
          :is="badgeSlot"
          v-if="badgeSlot"
          :badge="badge"
          :entity="entity"
          :node-id="id"
          :simplified="map.simplified.value"
        />
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
  </div>
</template>

<style>
.vnm-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--vnm-node-label-gap);
  width: var(--vnm-node-label-width);
  color: var(--vnm-fg);
  font-family: var(--vnm-font);
  font-size: var(--vnm-font-size-sm);
  line-height: var(--vnm-line-height-sm);
  text-align: center;
  cursor: pointer;
  transition: opacity var(--vnm-transition);
}

/* The circle and the label plate are outlined separately rather than as one
   rectangle around the node: there is empty space between them, and a shared
   frame would enclose that space too. */
.vnm-node:focus-visible {
  outline: none;
}

.vnm-node:focus-visible .vnm-node__circle,
.vnm-node:focus-visible .vnm-node__info {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 2px;
}

.vnm-node--selected .vnm-node__circle,
.vnm-node--selected .vnm-node__info {
  border-color: var(--vnm-selection);
}

.vnm-node--matched .vnm-node__circle,
.vnm-node--matched .vnm-node__info {
  border-color: var(--vnm-highlight);
}

.vnm-node--highlighted .vnm-node__circle,
.vnm-node--highlighted .vnm-node__info {
  border-color: var(--vnm-edge-active);
}

.vnm-node--dimmed {
  opacity: var(--vnm-dimmed-opacity);
}

/* Placed after the selection states on purpose: being captured outranks being
   selected, so infection wins the cascade. */
.vnm-node--infected .vnm-node__circle {
  border-color: var(--vnm-infected-border);
  background: var(--vnm-infected-bg);
  color: var(--vnm-infected-fg);
}

.vnm-node--infected .vnm-node__info {
  border-color: var(--vnm-infected-border);
  background: var(--vnm-infected-bg);
}

/* A hand-marked source is drawn heavier than the nodes it captured. */
.vnm-node--infection-source .vnm-node__circle {
  border-width: 2px;
}

.vnm-node__circle {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--vnm-node-size);
  height: var(--vnm-node-size);
  border: 1px solid var(--vnm-border);
  border-radius: 50%;
  background: var(--vnm-surface);
  box-shadow: var(--vnm-shadow-sm);
  color: var(--vnm-fg-muted);
}

.vnm-node--root .vnm-node__circle {
  width: var(--vnm-node-size-root);
  height: var(--vnm-node-size-root);
}

.vnm-node:hover .vnm-node__circle {
  border-color: var(--vnm-border-strong);
}

.vnm-node__icon {
  width: 55%;
  height: 55%;
}

.vnm-node__initials {
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  text-transform: uppercase;
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

.vnm-node__status {
  position: absolute;
  top: 0;
  right: 0;
  box-sizing: border-box;
  width: var(--vnm-node-status-size);
  height: var(--vnm-node-status-size);
  border: 1px solid var(--vnm-surface);
  border-radius: 50%;
  background: var(--vnm-status-unknown);
}

.vnm-node__toggle {
  position: absolute;
  top: calc(var(--vnm-node-toggle-size) / -3);
  right: calc(var(--vnm-node-toggle-size) / -3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--vnm-node-toggle-size);
  height: var(--vnm-node-toggle-size);
  padding: 0;
  border: 1px solid var(--vnm-border);
  border-radius: 50%;
  background: var(--vnm-surface);
  color: var(--vnm-fg-subtle);
  cursor: pointer;
}

/* On root nodes the status dot and the toggle must not overlap. */
.vnm-node--root .vnm-node__status {
  top: 2px;
  right: 2px;
}

.vnm-node__toggle:hover {
  border-color: var(--vnm-border-strong);
  background: var(--vnm-surface-sunken);
}

.vnm-node__toggle:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-node__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--vnm-node-label-width);
  height: var(--vnm-node-label-height);
  padding: var(--vnm-node-label-padding);
  /* Always present but transparent, so selecting a node cannot shift its
     contents by a pixel. */
  border: 1px solid transparent;
  border-radius: var(--vnm-node-label-radius);
  background: var(--vnm-surface);
  overflow: hidden;
  transition: border-color var(--vnm-transition);
}

.vnm-node__label {
  max-width: 100%;
  overflow: hidden;
  color: var(--vnm-node-label-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-node__sublabel,
.vnm-node__sublabel-overlay {
  max-width: 100%;
  overflow: hidden;
  line-height: var(--vnm-node-sublabel-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-node__sublabel {
  color: var(--vnm-node-sublabel-color);
}

/* The overlay address differs from the external one by color: in the logical
   view that is the only way to tell them apart at a glance. */
.vnm-node__sublabel-overlay {
  color: var(--vnm-node-overlay-color);
}

.vnm-node__markers {
  display: flex;
  justify-content: center;
  gap: var(--vnm-marker-gap);
  /* Spacing lives here rather than in the container's gap: the plate and the
     badges have their own distances, and one shared gap would break both. */
  margin-top: calc(var(--vnm-marker-offset) - var(--vnm-node-label-gap));
}

.vnm-node__marker {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--vnm-marker-size);
  height: var(--vnm-marker-size);
  padding: 0;
  border: 0;
  border-radius: 50%;
  /* Opaque backing, so a dot reads both over the plate and over the canvas. */
  background: var(--vnm-marker-bg);
  cursor: pointer;
}

.vnm-node__marker:focus-visible {
  outline: 2px solid var(--vnm-focus-ring);
  outline-offset: 1px;
}

.vnm-node__marker-dot {
  width: var(--vnm-marker-dot-size);
  height: var(--vnm-marker-dot-size);
  border-radius: 50%;
  background: var(--vnm-marker-1);
}

/* Badges go under the plate, not inside it: inside there is room for exactly
   three lines. */
.vnm-node__badges {
  display: flex;
  justify-content: center;
  gap: var(--vnm-space-1);
}

.vnm-node__badge {
  padding: 0 var(--vnm-space-1);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-accent-soft);
  color: var(--vnm-fg-subtle);
  font-size: var(--vnm-font-size-sm);
  line-height: 14px;
}

/* LOD: below the zoom threshold only the circle with its icon remains. */
.vnm-node--simplified {
  width: auto;
  gap: 0;
}
</style>
