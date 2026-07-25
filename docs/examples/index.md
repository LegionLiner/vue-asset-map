# Examples

Every example runs on the same demo infrastructure — clouds, VPS instances, routers, hypervisors, workstations and a
farm of containers — so behaviour can be compared across them. The source under each one is the file that renders it.

## Basic graph

Entities, links, icons and a radial layout. Click a node to open its details, drag to move it.

<LiveDemo :source="basicSource">
  <BasicMap />
</LiveDemo>

## Switching projections

One dataset, two topologies. The counter is computed by the page through `vue-asset-map/core`, so it always agrees
with what the map draws.

<LiveDemo :source="projectionsSource">
  <ProjectionsMap />
</LiveDemo>

## A collapsed group of 14 nodes

Fourteen containers on one hypervisor fold into a single group node with a count. Their edges move onto the group, and
the ones that were internal to it are counted rather than drawn. Click to expand.

<LiveDemo :source="collapsedSource">
  <CollapsedGroupMap />
</LiveDemo>

## Custom node component

`#node-workstation` replaces the contents of the circle for one kind only; every other node keeps the default
rendering.

<LiveDemo :source="customNodeSource">
  <CustomNodeMap />
</LiveDemo>

## Custom details panel

The `#details` slot with the application's own field labels. The package never guesses what lives in `meta`.

<LiveDemo :source="customDetailsSource">
  <CustomDetailsMap />
</LiveDemo>

## Dark theme

`theme` is a plain prop. The map reads the OS setting only when asked with `'auto'`, and never writes it anywhere.

<LiveDemo :source="darkSource">
  <DarkThemeMap />
</LiveDemo>

## Tracing a path between two nodes

Two nodes are pre-selected, so a path is already highlighted below. Shift-click two nodes of your own to trace a
different pair — Shift is the additive modifier that works everywhere, unlike Ctrl+click, which macOS treats as a
right click. The path is searched on the original graph and highlighted on the collapsed one.

<LiveDemo :source="pathSource">
  <PathTraceMap />
</LiveDemo>

## Membership markers

Dots under the labels, derived from the graph. A node connected to two hubs carries two of them. Hover one to
highlight everything that shares it.

<LiveDemo :source="markersSource">
  <MarkersMap />
</LiveDemo>

## Search and facet filters

Try `10.38.24.0/24`, `10.38.24.*` or a plain word in the search field, and open the filter panel on the left.

<LiveDemo :source="searchSource">
  <SearchMap />
</LiveDemo>

## Edge kinds and labels

`kind` selects the edge style, `directed` adds an arrow, and `#edge-label` replaces the caption.

<LiveDemo :source="edgeKindSource">
  <EdgeKindMap />
</LiveDemo>

## Switching layout engines

The same graph through `radial` and `manual`. Engine options pass through untouched.

<LiveDemo :source="layoutSource">
  <LayoutMap />
</LiveDemo>

## A large graph: 1000 nodes

Generated deterministically, collapsed at a threshold of 12, with only the visible elements mounted and the overview
map turned on.

<LiveDemo :source="largeSource" height="620px">
  <LargeGraphMap />
</LiveDemo>

<script setup>
import basicSource from '../.vitepress/demos/BasicMap.vue?raw'
import projectionsSource from '../.vitepress/demos/ProjectionsMap.vue?raw'
import collapsedSource from '../.vitepress/demos/CollapsedGroupMap.vue?raw'
import customNodeSource from '../.vitepress/demos/CustomNodeMap.vue?raw'
import customDetailsSource from '../.vitepress/demos/CustomDetailsMap.vue?raw'
import darkSource from '../.vitepress/demos/DarkThemeMap.vue?raw'
import pathSource from '../.vitepress/demos/PathTraceMap.vue?raw'
import markersSource from '../.vitepress/demos/MarkersMap.vue?raw'
import searchSource from '../.vitepress/demos/SearchMap.vue?raw'
import edgeKindSource from '../.vitepress/demos/EdgeKindMap.vue?raw'
import layoutSource from '../.vitepress/demos/LayoutMap.vue?raw'
import largeSource from '../.vitepress/demos/LargeGraphMap.vue?raw'
</script>
