---
layout: home

hero:
  name: VueAssetMap
  text: Infrastructure asset map for Vue 3
  tagline: A component for entities, links and views of one graph, with search, filters and path tracing.
  image:
    light: /hero-light.webp
    dark: /hero-dark.webp
    alt: vue-asset-map
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Examples
      link: /examples/
    - theme: alt
      text: GitHub
      link: https://github.com/LegionLiner/vue-asset-map

features:
  - title: One dataset, several views
    details: Declare entities and links once. A view keeps the links whose layers name it, so the same data renders as a physical topology or as a VPN overlay.
  - title: Search, filters and tracing
    details: Search by name, IPv4 wildcard or CIDR, filter by consumer-defined groups, open details in draggable windows, trace a path between two nodes.
  - title: Types, statuses and labels are yours
    details: No node types, no statuses, no view names and no UI strings live in the package. Icons, colors, filter groups and locales all come from your data.
---

<LiveDemo :source="basicSource" height="560px">
  <BasicMap />
</LiveDemo>

<script setup>
import basicSource from './.vitepress/demos/BasicMap.vue?raw'
</script>
