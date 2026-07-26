<script setup lang="ts">
import { computed } from 'vue'
import { useMapContext } from '../composables/useMapContext'
import type { LinkTypeDef } from '../types/linkType'

/**
 * Legend of connection kinds, bottom-left of the canvas.
 *
 * Bottom-left because the minimap already owns bottom-right and the toolbar the
 * top: it is the last corner that does not have to move out of anything's way.
 *
 * Each row draws the actual line the map draws — same colour, same dash, same
 * width — rather than a generic swatch. A legend that only approximates what is
 * on screen is worse than none, because it has to be trusted to be read.
 */
const props = defineProps<{
  types: readonly LinkTypeDef[]
}>()

const map = useMapContext()

/** A kind with neither colour nor dash is indistinguishable from the default. */
const rows = computed(() => props.types.filter((type) => type.color ?? type.dash ?? type.width))
</script>

<template>
  <div v-if="rows.length > 0" class="vam-legend" :aria-label="map.t('legend.label')" role="group">
    <span class="vam-legend__title">{{ map.t('legend.label') }}</span>

    <span v-for="type in rows" :key="type.id" class="vam-legend__row">
      <svg class="vam-legend__swatch" viewBox="0 0 24 8" aria-hidden="true">
        <line
          x1="0"
          y1="4"
          x2="24"
          y2="4"
          :stroke="type.color ?? 'var(--vam-edge)'"
          :stroke-width="type.width ?? 2"
          :stroke-dasharray="type.dash"
        />
      </svg>
      <span class="vam-legend__label">{{ type.label ?? type.id }}</span>
    </span>
  </div>
</template>

<style>
.vam-legend {
  position: absolute;
  z-index: 10;
  bottom: var(--vam-space-3);
  left: var(--vam-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-1);
  padding: var(--vam-space-2) var(--vam-space-3);
  border: 1px solid var(--vam-window-border);
  border-radius: var(--vam-radius-md);
  background: var(--vam-surface);
  box-shadow: var(--vam-window-shadow);
  color: var(--vam-fg);
  font-family: var(--vam-font);
  font-size: var(--vam-font-size-sm);
  line-height: var(--vam-line-height-sm);
}

.vam-legend__title {
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
  font-weight: var(--vam-font-weight-medium);
}

.vam-legend__row {
  display: flex;
  align-items: center;
  gap: var(--vam-space-2);
}

.vam-legend__swatch {
  flex: 0 0 auto;
  width: 24px;
  height: var(--vam-legend-swatch-size);
}

.vam-legend__label {
  color: var(--vam-fg-subtle);
  white-space: nowrap;
}
</style>
