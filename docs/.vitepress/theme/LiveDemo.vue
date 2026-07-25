<script setup lang="ts">
/**
 * Frame around a live example: the running component plus its own source.
 *
 * The source is handed in through Vite's `?raw`, so what is shown is byte for
 * byte what renders above it — a copied snippet could drift from the demo.
 */
defineProps<{
  title?: string
  source: string
  sourceLabel?: string
  height?: string
}>()
</script>

<template>
  <div class="live-demo">
    <div class="live-demo__stage" :style="{ height: height ?? '520px' }">
      <ClientOnly>
        <slot />
        <template #fallback>
          <div class="live-demo__fallback">Loading the map…</div>
        </template>
      </ClientOnly>
    </div>
    <details class="live-demo__source">
      <summary>{{ sourceLabel ?? 'Show source' }}</summary>
      <pre><code>{{ source }}</code></pre>
    </details>
  </div>
</template>

<style scoped>
.live-demo {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.live-demo__stage {
  position: relative;
  background: var(--vp-c-bg-soft);
}

.live-demo__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--vp-c-text-2);
}

.live-demo__source {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.live-demo__source summary {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  user-select: none;
}

.live-demo__source pre {
  max-height: 420px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  background: var(--vp-code-block-bg);
  font-size: 13px;
  line-height: 1.6;
}
</style>
