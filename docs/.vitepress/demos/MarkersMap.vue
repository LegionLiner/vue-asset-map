<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import { connectionMarkers } from 'vue-asset-map/core'
import { useSiteTheme } from '../theme/useSiteTheme'
import { entities, links, views, statusColors, kindIcons } from './fixture'

const theme = useSiteTheme()

// One marker per hub; a node carries the dot of every hub it is connected to,
// so a workstation wired to a router and joined to the VPN gets two. Markers
// are not restricted to a layer, so switching the view here does not change
// which dots a node shows — that persistence is the point of the demo.
const markers = connectionMarkers([
  { id: 'keenetic-1', label: 'Keenetic 1' },
  { id: 'keenetic-2', label: 'Keenetic 2' },
  { id: 'vps-tailscale', label: 'Tailscale VPS' },
])

const view = ref('physical')
</script>

<template>
  <AssetMap
    v-model:view="view"
    class="demo-map"
    :entities="entities"
    :links="links"
    :views="views"
    :markers="markers"
    :marker-hover-delay="300"
    :theme="theme"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial', options: { rootId: view === 'physical' ? 'internet' : 'vps-tailscale' } }"
    auto-fit-view
  />
</template>
