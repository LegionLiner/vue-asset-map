<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import { connectionMarkers } from 'vue-asset-map/core'
import { entities, links, views, statusColors, kindIcons } from './fixture'

// One marker per hub; a node carries the dot of every hub it is connected to,
// so a workstation wired to a router and joined to the VPN gets two.
const markers = connectionMarkers([
  { id: 'keenetic-1', label: 'Keenetic 1' },
  { id: 'keenetic-2', label: 'Keenetic 2' },
  { id: 'vps-tailscale', label: 'Tailscale VPS' },
])
</script>

<template>
  <AssetMap
    class="demo-map"
    view="physical"
    :entities="entities"
    :links="links"
    :views="views"
    :markers="markers"
    :marker-hover-delay="300"
    :theme-config="{ statusColors, kindIcons }"
    :layout="{ engine: 'radial' }"
  />
</template>
