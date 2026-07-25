<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext } from '../../composables/useMapContext'
import type { NetworkNodeData } from '../../composables/useFlowElements'

/**
 * Свёрнутая группа однотипных узлов.
 *
 * Показывает, что именно спрятано (ведро, число участников, число внутренних
 * связей) и раскрывается по клику. Без этих чисел свёртка выглядела бы как
 * пропажа данных.
 */
const props = defineProps<{
  id: string
  data?: NetworkNodeData
}>()

const map = useMapContext()

const group = computed(() => (props.data?.variant === 'group' ? props.data.group : undefined))

const memberCount = computed(() => group.value?.memberIds.length ?? 0)
const internalLinkCount = computed(() => group.value?.internalLinkCount ?? 0)

/** Состояния участников: группа не должна прятать факт «внутри что-то упало». */
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
  'vnm-node',
  'vnm-group',
  {
    'vnm-node--matched': map.isMatched(props.id),
    'vnm-node--dimmed': map.isDimmed(props.id),
    'vnm-node--simplified': map.simplified.value,
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
    <Handle type="target" :position="Position.Top" class="vnm-node__handle" />
    <Handle type="source" :position="Position.Bottom" class="vnm-node__handle" />

    <span class="vnm-group__stack" aria-hidden="true">
      <span class="vnm-group__count">{{ memberCount }}</span>
    </span>

    <span class="vnm-node__body">
      <span class="vnm-node__label">{{ label }}</span>
      <span v-if="!map.simplified.value" class="vnm-group__meta">
        {{ map.t('group.members', { count: memberCount }) }}
      </span>
      <span v-if="!map.simplified.value && internalLinkCount > 0" class="vnm-group__meta">
        {{ map.t('group.internalLinks', { count: internalLinkCount }) }}
      </span>
    </span>

    <span v-if="!map.simplified.value && memberStatuses.length > 0" class="vnm-group__statuses">
      <span
        v-for="entry in memberStatuses"
        :key="entry.status"
        class="vnm-group__status"
        :style="entry.color ? { backgroundColor: entry.color } : undefined"
        :title="map.t('node.status', { status: entry.status })"
      >
        {{ entry.count }}
      </span>
    </span>
  </div>
</template>

<style>
.vnm-group {
  /* Двойная рамка-«стопка»: узел читается как «здесь их много». */
  box-shadow:
    var(--vnm-shadow-sm),
    4px 4px 0 -1px var(--vnm-surface),
    5px 5px 0 -1px var(--vnm-border);
  border-style: dashed;
}

.vnm-group:hover {
  box-shadow:
    var(--vnm-shadow-md),
    4px 4px 0 -1px var(--vnm-surface),
    5px 5px 0 -1px var(--vnm-border-strong);
}

.vnm-group__stack {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--vnm-space-1);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-accent-soft);
  color: var(--vnm-accent);
}

.vnm-group__count {
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
}

.vnm-group__meta {
  overflow: hidden;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vnm-group__statuses {
  position: absolute;
  top: -8px;
  right: var(--vnm-space-2);
  display: flex;
  gap: var(--vnm-space-1);
}

.vnm-group__status {
  min-width: 16px;
  padding: 0 3px;
  border: 1px solid var(--vnm-surface);
  border-radius: var(--vnm-radius-sm);
  background: var(--vnm-status-unknown);
  color: var(--vnm-fg-inverted);
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  line-height: 14px;
  text-align: center;
}
</style>
