<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { useSiteTheme } from '../theme/useSiteTheme'
import { entities, links, views, statusColors, kindIcons } from './fixture'

// The fixture holds 14 containers on one hypervisor; a threshold of 4 folds
// them into a single group node. Click it to expand.
const expanded = ref(new Set<string>())
const theme = useSiteTheme()
</script>

<template>
  <AssetMap
    v-model:expanded="expanded"
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :collapse="{ threshold: 4 }"
    :theme="theme"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'manual', options: { columns: 5 } }"
    auto-fit-view
  />
</template>
