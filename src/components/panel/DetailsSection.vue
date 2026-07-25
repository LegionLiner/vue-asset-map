<script setup lang="ts">
/**
 * One section of the details panel: a heading plus content.
 *
 * Exists so that a consumer filling the `#details` slot can assemble a panel out
 * of the same blocks the default implementation uses, instead of matching
 * spacing and typography by eye.
 */
defineProps<{
  title: string
  /** Render the section as empty instead of hiding it — for "no data" states. */
  empty?: boolean
}>()
</script>

<template>
  <section class="vnm-section">
    <h4 class="vnm-section__title">{{ title }}</h4>
    <div v-if="empty" class="vnm-section__empty">
      <slot name="empty" />
    </div>
    <div v-else class="vnm-section__body">
      <slot />
    </div>
  </section>
</template>

<style>
.vnm-section {
  display: flex;
  flex-direction: column;
  gap: var(--vnm-space-2);
}

.vnm-section__title {
  margin: 0;
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
  font-weight: var(--vnm-font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vnm-section__body {
  display: grid;
  grid-template-columns: minmax(0, 40%) minmax(0, 1fr);
  gap: var(--vnm-space-1) var(--vnm-space-3);
  font-size: var(--vnm-font-size);
}

.vnm-section__empty {
  color: var(--vnm-fg-muted);
  font-size: var(--vnm-font-size-sm);
}

.vnm-field__key {
  overflow: hidden;
  color: var(--vnm-fg-muted);
  text-overflow: ellipsis;
}

.vnm-field__value {
  overflow-wrap: anywhere;
  font-family: var(--vnm-font-mono);
}
</style>
