<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import type { AssetLink } from 'vue-asset-map'
import { entities, links, views, statusColors, kindIcons } from './fixture'

// `kind` selects the edge style through a CSS class; `directed` adds an arrow.
// Nothing here is hardcoded in the package — both come from the data.
const styled: AssetLink[] = links.map((link) =>
  link.layers.includes('logical') ? { ...link, kind: 'dashed', directed: true } : link,
)
</script>

<template>
  <AssetMap
    class="demo-map"
    view="logical"
    :entities="entities"
    :links="styled"
    :views="views"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial' }"
  >
    <template #edge-label="{ link, aggregated, count }">
      <span class="edge-label">
        {{ aggregated ? `${count} links` : (link?.label ?? link?.kind ?? '') }}
      </span>
    </template>
  </AssetMap>
</template>

<style scoped>
.edge-label {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--vp-c-bg);
  font-size: 11px;
}
</style>
