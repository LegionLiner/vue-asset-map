<script setup lang="ts">
import { computed, ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { dagreLayout } from 'vue-asset-map/layout-dagre'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const ENGINES = ['radial', 'manual', 'dagre'] as const
const engineIndex = ref(0)
const engineName = computed(() => ENGINES[engineIndex.value % ENGINES.length])

// Engine options are engine-specific and pass through untouched. `dagre` is
// passed as an instance rather than by name: it lives behind an optional
// dependency and is never registered under the built-in names.
const layout = computed(() => {
  switch (engineName.value) {
    case 'radial':
      return { engine: 'radial', options: { radius: 240, ringGap: 190 } }
    case 'dagre':
      return { engine: dagreLayout, options: { rankdir: 'TB', ranksep: 90 } }
    default:
      return { engine: 'manual', options: { columns: 6 } }
  }
})

function nextEngine(): void {
  engineIndex.value += 1
}
</script>

<template>
  <AssetMap
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :layout="layout"
    :theme-config="{ statusColors, kindIcons }"
    auto-fit-view
  >
    <template #toolbar-right>
      <button type="button" class="demo-toolbar-button" @click="nextEngine">Engine: {{ engineName }}</button>
    </template>
  </AssetMap>
</template>
