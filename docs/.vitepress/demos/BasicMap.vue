<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const view = ref('physical')
const selection = ref<string[]>([])
</script>

<template>
  <AssetMap
    v-model:view="view"
    v-model:selection="selection"
    class="demo-map"
    :entities="entities"
    :links="links"
    :views="views"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: 'internet' } }"
    auto-fit-view
  />
</template>
