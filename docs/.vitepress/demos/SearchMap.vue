<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap, emptyFilterState } from 'vue-asset-map'
import type { FilterState } from 'vue-asset-map'
import { entities, links, views, filterGroups, statusColors, kindIcons } from './fixture'

const filters = ref<FilterState>(emptyFilterState())
const openFilterGroups = ref<string[]>(['subnet'])

// Try `10.38.24.*` or `10.38.24.0/24` in the search field.
function preset(query: string): void {
  filters.value = { ...filters.value, query }
}
</script>

<template>
  <AssetMap
    v-model:filters="filters"
    v-model:open-filter-groups="openFilterGroups"
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :filter-options="{ groups: filterGroups, neighborDepth: 1 }"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: 'internet' } }"
    auto-fit-view
  >
    <template #toolbar-right>
      <button type="button" class="demo-toolbar-button" @click="preset('10.38.24.0/24')">
        CIDR 10.38.24.0/24
      </button>
      <button type="button" class="demo-toolbar-button" @click="preset('')">Reset</button>
    </template>
  </AssetMap>
</template>
