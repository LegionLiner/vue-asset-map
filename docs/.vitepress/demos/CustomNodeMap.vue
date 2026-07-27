<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import { dagreLayout } from 'vue-asset-map/layout-dagre'
import { useSiteTheme } from '../theme/useSiteTheme'
import { useSiteLocale } from '../theme/useSiteLocale'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const theme = useSiteTheme()
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
    :layout="{ engine: dagreLayout, options: { rankdir: 'TB', ranksep: 70, nodesep: 32 } }"
    auto-fit-view
  >
    <!-- Replaces the contents of the circle for one type only; every other
         node keeps the default rendering. -->
    <template #node-workstation="{ entity, simplified }">
      <span class="ws-badge" :title="entity?.label">
        {{ simplified ? '·' : (entity?.label ?? '?').slice(0, 2).toUpperCase() }}
      </span>
    </template>
  </AssetMap>
</template>

<style scoped>
.ws-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #5a5ee7;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
</style>
