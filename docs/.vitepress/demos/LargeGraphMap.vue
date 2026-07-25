<script setup lang="ts">
import { shallowRef } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { generateLargeGraph } from './fixture'

// 1000 nodes and roughly 1400 links, generated deterministically so the demo
// looks the same on every visit.
const large = shallowRef(generateLargeGraph(1000, 1400))
</script>

<template>
  <AssetMap
    class="demo-map"
    :entities="large.entities"
    :links="large.links"
    :collapse="{ threshold: 12 }"
    :layout="{ engine: 'radial' }"
    :only-render-visible-elements="true"
    :show-minimap="true"
  />
</template>
