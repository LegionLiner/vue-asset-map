<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { useSiteTheme } from '../theme/useSiteTheme'
import { useSiteLocale } from '../theme/useSiteLocale'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const view = ref('physical')
const selection = ref<string[]>([])
const theme = useSiteTheme()
const locale = useSiteLocale()
</script>

<template>
  <AssetMap
    v-model:view="view"
    v-model:selection="selection"
    class="demo-map"
    :entities="entities"
    :links="links"
    :views="views"
    :theme="theme"
    :locale="locale"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: 'internet' } }"
    auto-fit-view
  />
</template>
