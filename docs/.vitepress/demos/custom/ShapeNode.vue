<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetNodeData } from 'vue-asset-map'

/**
 * A node component that owes nothing to the default one.
 *
 * Registered through `nodeTypes`, so it replaces `BaseNode` outright rather than
 * filling a slot inside it: that is the only way to change the *shape*, since a
 * `#node-{type}` slot swaps what is inside the circle and leaves the circle.
 *
 * Everything it needs comes from `useMapContext()` — selection, dimming, the
 * click handlers — so the component takes no props beyond what Vue Flow gives
 * every node. Interactions go through the context rather than Vue Flow's own
 * events, which is what keeps them identical for mouse and keyboard.
 */
const props = defineProps<{
  id: string
  data?: AssetNodeData
  connectable?: boolean
}>()

const map = useMapContext()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))

/**
 * The shape each kind is drawn as.
 *
 * Shape carries the type, so the map is readable in one glance and stays
 * readable in monochrome — colour alone would not survive a printout.
 */
const SHAPES: Record<string, string> = {
  cloud: 'pill',
  router: 'diamond',
  hypervisor: 'square',
  vps: 'hexagon',
  workstation: 'squircle',
  container: 'octagon',
}

const shape = computed(() => SHAPES[entity.value?.type ?? ''] ?? 'square')

/** Accent per kind, used for the fill and for the connector dots. */
const TINTS: Record<string, string> = {
  cloud: '#7c5cff',
  router: '#e0873a',
  hypervisor: '#2f9e6f',
  vps: '#3a7ce0',
  workstation: '#c8467c',
  container: '#4aa3c7',
}

const tint = computed(() => TINTS[entity.value?.type ?? ''] ?? '#7c8aa5')

const selected = computed(() => map.isSelected(props.id))
const dimmed = computed(() => map.isDimmed(props.id))
const matched = computed(() => map.isMatched(props.id))

const initials = computed(() =>
  (entity.value?.label ?? props.id)
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join(''),
)

const CONNECTOR_SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  map.onNodeClick(props.id, new MouseEvent('click', { shiftKey: event.shiftKey }))
}
</script>

<template>
  <div
    class="shape-node"
    :class="[`shape-node--${shape}`, { 'is-selected': selected, 'is-dimmed': dimmed, 'is-matched': matched }]"
    role="button"
    tabindex="0"
    :aria-label="entity?.label ?? id"
    :style="{ '--tint': tint }"
    @click="map.onNodeClick(id, $event)"
    @contextmenu="map.onNodeContextMenu(id, $event)"
    @keydown="onKeydown"
  >
    <!-- Centre handles first: an edge that names no handle resolves to the
         first of its type, so these stay the anchors and lines run centre to
         centre however many connectors are added below. -->
    <Handle type="target" :position="Position.Top" class="shape-node__anchor" />
    <Handle type="source" :position="Position.Bottom" class="shape-node__anchor" />

    <div class="shape-node__body">
      <span class="shape-node__ring" aria-hidden="true" />
      <span class="shape-node__fill">
        <span class="shape-node__initials">{{ initials }}</span>
      </span>

      <span
        v-if="entity?.status"
        class="shape-node__status"
        :class="`shape-node__status--${entity.status}`"
        :title="entity.status"
      />

      <template v-if="connectable">
        <Handle
          v-for="side in CONNECTOR_SIDES"
          :id="`shape-${side.id}`"
          :key="side.id"
          type="source"
          :position="side.position"
          :class="['shape-node__connector', `shape-node__connector--${side.id}`]"
        />
      </template>
    </div>

    <!-- The label plate is this component's own: a custom node draws its own
         text, so `maxSublabels` and `#node-label` do not apply here. -->
    <div v-if="!map.simplified.value" class="shape-node__plate">
      <span class="shape-node__label">{{ entity?.label ?? id }}</span>
      <span v-if="entity?.sublabels?.[0]" class="shape-node__sub">{{ entity.sublabels[0] }}</span>
    </div>
  </div>
</template>

<style>
.shape-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: max-content;
  max-width: 140px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  cursor: pointer;
  transition: opacity 140ms ease;
}

.shape-node.is-dimmed {
  opacity: 0.25;
}

.shape-node__body {
  position: relative;
  width: 46px;
  height: 46px;
}

/* Ring and fill are two clipped layers rather than a border: `clip-path` cuts
   borders off, so the outline has to be a slightly larger shape behind. */
.shape-node__ring,
.shape-node__fill {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shape-node__ring {
  background: var(--tint);
  opacity: 0.35;
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.shape-node__fill {
  inset: 3px;
  background: color-mix(in srgb, var(--tint) 16%, var(--vp-c-bg));
}

.shape-node.is-selected .shape-node__ring {
  opacity: 1;
  transform: scale(1.06);
}

.shape-node.is-matched .shape-node__ring {
  opacity: 1;
  background: #e0a256;
}

.shape-node__initials {
  color: var(--tint);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

/* One clip per kind. `border-radius` handles the two round ones. */
.shape-node--square .shape-node__ring,
.shape-node--square .shape-node__fill {
  border-radius: 2px;
}

.shape-node--squircle .shape-node__ring,
.shape-node--squircle .shape-node__fill {
  border-radius: 14px;
}

.shape-node--pill .shape-node__ring,
.shape-node--pill .shape-node__fill {
  border-radius: 999px;
}

.shape-node--diamond .shape-node__ring,
.shape-node--diamond .shape-node__fill {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.shape-node--hexagon .shape-node__ring,
.shape-node--hexagon .shape-node__fill {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

.shape-node--octagon .shape-node__ring,
.shape-node--octagon .shape-node__fill {
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
}

.shape-node__status {
  position: absolute;
  z-index: 2;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--vp-c-bg);
  border-radius: 50%;
  background: #9aa7bd;
}

.shape-node__status--online {
  background: #3fa564;
}

.shape-node__status--offline {
  background: #d05353;
}

.shape-node__status--degraded {
  background: #d9822b;
}

.shape-node__plate {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 100%;
}

.shape-node__label {
  max-width: 100%;
  overflow: hidden;
  color: var(--vp-c-text-1);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shape-node__sub {
  color: var(--vp-c-text-3);
  font-size: 10px;
}

/* The rendering anchors: invisible and untouchable, purely geometry for edges. */
.shape-node__anchor {
  top: 50% !important;
  left: 50% !important;
  width: 1px !important;
  height: 1px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: 0 !important;
  background: transparent !important;
  opacity: 0;
  pointer-events: none !important;
}

.shape-node__connector {
  position: absolute !important;
  z-index: 3;
  width: 9px !important;
  height: 9px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  border: 2px solid var(--vp-c-bg) !important;
  border-radius: 50%;
  background: var(--tint) !important;
  opacity: 0;
  cursor: crosshair;
  transition: opacity 140ms ease;
  pointer-events: all !important;
}

.shape-node:hover .shape-node__connector,
.shape-node:focus-within .shape-node__connector {
  opacity: 1;
}

.shape-node__connector--top {
  top: -5px !important;
  left: 50% !important;
  transform: translateX(-50%);
}

.shape-node__connector--bottom {
  top: auto !important;
  bottom: -5px !important;
  left: 50% !important;
  transform: translateX(-50%);
}

.shape-node__connector--left {
  top: 50% !important;
  left: -5px !important;
  transform: translateY(-50%);
}

.shape-node__connector--right {
  top: 50% !important;
  right: -5px !important;
  left: auto !important;
  transform: translateY(-50%);
}
</style>
