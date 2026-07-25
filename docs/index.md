---
layout: home

hero:
  name: vue-asset-map
  text: Infrastructure asset map for Vue 3
  tagline: Entities, links and projections of one graph — searchable, filterable and traceable.
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
  - title: One graph, many projections
    details: Declare entities and links once. A view keeps the links whose layers name it, so the same data renders as a physical topology or as a VPN overlay.
  - title: Built for clicking
    details: Search by name, IPv4 wildcard or CIDR, filter by consumer-defined facets, open details in draggable windows, trace a path between two nodes.
  - title: Nothing hardcoded
    details: No node kinds, no statuses, no view names and no UI strings live in the package. Icons, colors, filter groups and locales all come from your data.
---

<LiveDemo :source="basicSource" height="560px">
  <BasicMap />
</LiveDemo>

<script setup>
import basicSource from './.vitepress/demos/BasicMap.vue?raw'
</script>
