<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import { entities, links, views, statusColors, kindIcons } from './fixture'
</script>

<template>
  <AssetMap
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial' }"
  >
    <!-- Replaces the contents of the circle for one kind only; every other
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
