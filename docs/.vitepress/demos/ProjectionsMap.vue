<script setup lang="ts">
import { computed, ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { projectGraph, buildGraph, resolveView } from 'vue-asset-map/core'
import { entities, links, views, statusColors, kindIcons } from './fixture'

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
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial' }"
  >
    <template #toolbar-right>
      <span class="demo-toolbar-button">
        {{ visible.nodes }} nodes · {{ visible.links }} links
      </span>
    </template>
  </AssetMap>
</template>
