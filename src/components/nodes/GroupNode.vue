<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext } from '../../composables/useMapContext'
import type { AssetNodeData } from '../../composables/useFlowElements'

/**
 * A collapsed group of same-kind nodes.
 *
 * The same circle and plate as an ordinary node, but the icon is replaced by the
 * member count: collapsing must not look like data going missing, so the count
 * takes the most visible spot.
 */
const props = defineProps<{
  id: string
  data?: AssetNodeData
}>()

const map = useMapContext()

const group = computed(() => (props.data?.variant === 'group' ? props.data.group : undefined))

const memberCount = computed(() => group.value?.memberIds.length ?? 0)
const internalLinkCount = computed(() => group.value?.internalLinkCount ?? 0)

// Member statuses are surfaced so a group cannot hide that something inside it
// is down.
const memberStatuses = computed(() => {
  const counts = new Map<string, number>()
  for (const memberId of group.value?.memberIds ?? []) {
    const status = map.entityById(memberId)?.status
    if (status === undefined) continue
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }
  return [...counts].map(([status, count]) => ({ status, count, color: map.statusColorOf(status) }))
})

const label = computed(() => map.t('group.label', { bucket: group.value?.bucket ?? '' }))

const ariaLabel = computed(
  () => `${label.value}. ${map.t('group.members', { count: memberCount.value })}. ${map.t('group.expand')}`,
)

const classes = computed(() => [
  'vam-node',
  'vam-node--child',
  'vam-group',
  {
    'vam-node--matched': map.isMatched(props.id),
    'vam-node--dimmed': map.isDimmed(props.id),
    'vam-node--simplified': map.simplified.value,
    // A group counts as infected when any single member is captured, otherwise
    // collapsing would conceal the infection.
    'vam-node--infected': map.isInfected(props.id),
  },
])

function onActivate(event: Event): void {
  map.onGroupToggle(props.id, event)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onActivate(event)
}
</script>

<template>
  <div
    :class="classes"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    aria-expanded="false"
    @click="onActivate"
    @keydown="onKeydown"
  >
    <Handle type="target" :position="Position.Top" class="vam-node__handle" />
    <Handle type="source" :position="Position.Bottom" class="vam-node__handle" />

    <div class="vam-node__circle vam-group__circle">
      <span class="vam-group__count">{{ memberCount }}</span>

      <span v-if="memberStatuses.length > 0" class="vam-group__statuses">
        <span
          v-for="entry in memberStatuses"
          :key="entry.status"
          class="vam-group__status"
          :style="entry.color ? { backgroundColor: entry.color } : undefined"
          :title="map.t('node.status', { status: entry.status })"
        />
      </span>
    </div>

    <div v-if="!map.simplified.value" class="vam-node__info">
      <span class="vam-node__label">{{ label }}</span>
      <span class="vam-node__sublabel">{{ map.t('group.members', { count: memberCount }) }}</span>
      <span v-if="internalLinkCount > 0" class="vam-node__sublabel">
        {{ map.t('group.internalLinks', { count: internalLinkCount }) }}
      </span>
    </div>
  </div>
</template>

<style>
/* Dashed frame plus a "stack" behind the circle, so the node reads as "many". */
.vam-group__circle {
  border-style: dashed;
  background: var(--vam-surface-sunken);
  box-shadow:
    var(--vam-shadow-sm),
    3px 3px 0 -1px var(--vam-surface),
    4px 4px 0 -1px var(--vam-border);
  color: var(--vam-fg-subtle);
}

.vam-group__count {
  font-size: var(--vam-font-size);
  font-weight: var(--vam-font-weight-bold);
}

.vam-group__statuses {
  position: absolute;
  top: -2px;
  right: -2px;
  display: flex;
  gap: 1px;
}

.vam-group__status {
  box-sizing: border-box;
  width: 7px;
  height: 7px;
  border: 1px solid var(--vam-surface);
  border-radius: 50%;
  background: var(--vam-status-unknown);
}
</style>
