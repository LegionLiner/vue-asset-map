<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import type { AssetLink } from 'vue-asset-map'
import { dagreLayout } from 'vue-asset-map/layout-dagre'
import { useSiteTheme } from '../theme/useSiteTheme'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const theme = useSiteTheme()

// `type` selects the edge style through a CSS class; `directed` adds an arrow.
// Nothing here is hardcoded in the package — both come from the data. A
// left-to-right layered layout reads a directed arrow more clearly than a
// radial one, where every arrow points along a different curve.
const styled: AssetLink[] = links.map((link) =>
  link.layers.includes('logical') ? { ...link, type: 'dashed', directed: true } : link,
)
</script>

<template>
  <AssetMap
    class="demo-map"
    view="logical"
    :entities="entities"
    :links="styled"
    :views="views"
    :theme="theme"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: dagreLayout, options: { rankdir: 'LR', ranksep: 110 } }"
    auto-fit-view
  >
    <template #edge-label="{ link, aggregated, count }">
      <span class="edge-label">
        {{ aggregated ? `${count} links` : (link?.label ?? link?.type ?? '') }}
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
