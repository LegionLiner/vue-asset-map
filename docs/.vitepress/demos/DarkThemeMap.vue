<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { useSiteLocale } from '../theme/useSiteLocale'
import { entities, links, views, statusColors, kindIcons } from './fixture'

// `theme` is a plain prop: the map does not read the OS setting unless asked
// with 'auto', and never writes it anywhere.
const theme = ref<'light' | 'dark'>('dark')
const locale = useSiteLocale()
</script>

<template>
  <AssetMap
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :theme="theme"
    :locale="locale"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: 'internet' } }"
    auto-fit-view
  >
    <template #toolbar-right>
      <button type="button" class="demo-toolbar-button" @click="theme = theme === 'dark' ? 'light' : 'dark'">
        {{ theme === 'dark' ? 'Switch to light' : 'Switch to dark' }}
      </button>
    </template>
  </AssetMap>
</template>
