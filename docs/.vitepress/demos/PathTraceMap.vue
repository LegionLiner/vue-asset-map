<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { AssetMap } from 'vue-asset-map'
import type { AssetMapExposed } from 'vue-asset-map'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const map = useTemplateRef<AssetMapExposed>('map')
const selection = ref<string[]>([])
const traced = ref<string[]>([])

// `highlightPath` searches the original graph and highlights it on the
// collapsed one, so a stretch hidden inside a group still lights up.
function trace(): void {
  const [from, to] = selection.value
  traced.value = from && to ? (map.value?.highlightPath(from, to) ?? []) : []
}

function clear(): void {
  map.value?.clearHighlight()
  traced.value = []
}
</script>

<template>
  <AssetMap
    ref="map"
    v-model:selection="selection"
    class="demo-map"
    view="logical"
    :entities="entities"
    :links="links"
    :views="views"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial' }"
  >
    <template #toolbar-right>
      <button
        type="button"
        class="demo-toolbar-button"
        :disabled="selection.length !== 2"
        @click="trace"
      >
        Trace path ({{ selection.length }}/2 selected)
      </button>
      <button v-if="traced.length" type="button" class="demo-toolbar-button" @click="clear">
        Clear · {{ traced.length }} hops
      </button>
    </template>
  </AssetMap>
</template>
