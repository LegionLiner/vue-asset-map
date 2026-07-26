<script setup lang="ts">
import { computed, ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import type { AssetView } from 'vue-asset-map'
import { projectGraph, buildGraph, resolveView } from 'vue-asset-map/core'
import { dagreLayout } from 'vue-asset-map/layout-dagre'
import { useSiteTheme } from '../theme/useSiteTheme'
import { entities, links, views as sourceViews, statusColors, kindIcons } from './fixture'

const theme = useSiteTheme()

// A view can carry its own layout (see the "Views" guide page): copied here so
// each projection is not just a filtered subset of the same picture but visibly
// its own shape. The shared `sourceViews` array is never mutated — each entry
// is spread into a new object.
const views: AssetView[] = sourceViews.map((view) =>
  view.id === 'logical'
    ? { ...view, layout: { engine: dagreLayout, options: { rankdir: 'LR', ranksep: 90 } } }
    : { ...view, layout: { engine: 'radial', options: { rootId: 'internet', radius: 170, ringGap: 140 } } },
)

const view = ref('physical')

// The same projection the map runs internally, used here only for the counter.
const graph = buildGraph(entities, links)
const visible = computed(() => {
  const result = projectGraph(graph, resolveView(views, view.value))
  return { nodes: result.entityIds.size, links: result.linkIds.size }
})
</script>

<template>
  <AssetMap
    v-model:view="view"
    class="demo-map"
    :entities="entities"
    :links="links"
    :views="views"
    :theme="theme"
    :theme-config="{ statusColors, kindIcons }"
    auto-fit-view
  >
    <template #toolbar-right>
      <span class="demo-toolbar-button">{{ visible.nodes }} nodes · {{ visible.links }} links</span>
    </template>
  </AssetMap>
</template>
