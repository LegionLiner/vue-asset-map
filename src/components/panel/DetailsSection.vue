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
  <section class="vam-section">
    <h4 class="vam-section__title">{{ title }}</h4>
    <div v-if="empty" class="vam-section__empty">
      <slot name="empty" />
    </div>
    <div v-else class="vam-section__body">
      <slot />
    </div>
  </section>
</template>

<style>
.vam-section {
  display: flex;
  flex-direction: column;
  gap: var(--vam-space-2);
}

.vam-section__title {
  margin: 0;
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
  font-weight: var(--vam-font-weight-bold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vam-section__body {
  display: grid;
  grid-template-columns: minmax(0, 40%) minmax(0, 1fr);
  gap: var(--vam-space-1) var(--vam-space-3);
  font-size: var(--vam-font-size);
}

.vam-section__empty {
  color: var(--vam-fg-muted);
  font-size: var(--vam-font-size-sm);
}

.vam-field__key {
  overflow: hidden;
  color: var(--vam-fg-muted);
  text-overflow: ellipsis;
}

.vam-field__value {
  overflow-wrap: anywhere;
  font-family: var(--vam-font-mono);
}
</style>
