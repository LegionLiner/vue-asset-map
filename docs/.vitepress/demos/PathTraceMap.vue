<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { useSiteTheme } from '../theme/useSiteTheme'
import { useSiteLocale } from '../theme/useSiteLocale'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const theme = useSiteTheme()
const locale = useSiteLocale()
const selection = ref<string[]>(['ws-artjom', 'ws-vlad'])
const traced = ref<string[]>([])

// `autoPath` traces the pair itself, so there is no button to press and nothing
// to call on mount — the pre-selected pair is already highlighted on the first
// frame. The route arrives through `path-change` in original entity ids; it is
// searched on the original graph and drawn on the collapsed one, so a stretch
// hidden inside a group still lights up.
function onPathChange(path: string[]): void {
  traced.value = path
}

// Clearing the selection is all it takes: the trace follows it.
function clear(): void {
  selection.value = []
}
</script>

<template>
  <AssetMap
    v-model:selection="selection"
    class="demo-map"
    view="logical"
    :entities="entities"
    :links="links"
    :views="views"
    :theme="theme"
    :locale="locale"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: 'vps-tailscale' } }"
    auto-path
    auto-fit-view
    @path-change="onPathChange"
  >
    <template #toolbar-right>
      <span class="demo-toolbar-button demo-toolbar-button--hint">
        Shift-click two nodes — the path traces itself
      </span>
      <button v-if="traced.length" type="button" class="demo-toolbar-button" @click="clear">
        Clear · {{ traced.length }} hops
      </button>
    </template>
  </AssetMap>
</template>

<style scoped>
.demo-toolbar-button--hint {
  cursor: default;
  color: var(--vp-c-text-2);
}

.demo-toolbar-button--hint:hover {
  border-color: var(--vp-c-divider);
}
</style>
