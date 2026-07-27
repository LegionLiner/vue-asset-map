# Examples

Every example runs on the same demo infrastructure — clouds, VPS instances, routers, hypervisors, workstations and a
farm of containers — so behaviour can be compared across them. The source under each one is the file that renders it.

## Basic graph

Entities, links, icons and a radial layout. Click a node to open its details, drag to move it.

<LiveDemo :source="basicSource">
  <BasicMap />
</LiveDemo>

## Switching views

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

`#node-workstation` replaces the contents of the circle for one type only; every other node keeps the default
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

`autoPath` traces the pair itself: two nodes are pre-selected, so a path is already highlighted below with nothing
called. Shift-click two nodes of your own to trace a different pair — Shift is the additive modifier that works
everywhere, unlike Ctrl+click, which macOS treats as a right click, and a modified click only selects, leaving no
window over the path. The route arrives through `path-change`; it is searched on the original graph and highlighted on
the collapsed one.

<LiveDemo :source="pathSource">
  <PathTraceMap />
</LiveDemo>

## Membership markers

Dots under the labels, derived from the graph. A node connected to two hubs carries two of them. Hover one to
highlight everything that shares it.

<LiveDemo :source="markersSource">
  <MarkersMap />
</LiveDemo>

## Search and filter groups

Try `10.38.24.0/24`, `10.38.24.*` or a plain word in the search field, and open the filter panel on the left.

<LiveDemo :source="searchSource">
  <SearchMap />
</LiveDemo>

## Edge types and labels

`type` selects the edge style, `directed` adds an arrow, and `#edge-label` replaces the caption.

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

## Everything replaceable, replaced

The other examples change one thing at a time. This one keeps the graph, the projections, the layout, the search and
the traversals — and replaces every pixel above them.

Nothing here reaches into the package: each piece is a documented prop or slot.

- **Shapes instead of circles.** A `nodeTypes` component draws a pill, a diamond, a square, a hexagon, a squircle and
  an octagon, one per kind. Shape had to replace the circle outright, so this is a component rather than a
  `#node-{type}` slot — a slot swaps what is _inside_ the circle and leaves the circle. Shape carries the type, so the
  map stays readable in monochrome.
- **Right-angled cabling.** An `edgeTypes` component swaps the bezier for a smooth-step run and puts its own chip on
  the line. Colour and dash still come from `linkTypes`, read through `useMapContext()`.
- **Its own chrome.** `showToolbar` is off; the bar above the map is ordinary page markup driving
  `v-model:filters`, `v-model:view` and the exposed `fitView` / `relayout`. The filter chips repeat the node shapes,
  so a filter shows which shape it selects rather than only naming it.
- **Its own window.** `showDetailsHeading` is off, `detailsTitle` is a function, and `#details-title`,
  `#details-tabs` and `#details` supply the rest. Only the title bar survives from the package.
- **Its own form.** `#details-edit` renders the consumer's controls; the package contributes the draft, the save and
  the cancel, and nothing else.
- **Its own menu and modal.** `showContextMenu` stays off and the page handles `node-context-menu` itself, then
  confirms with a dialog of its own. The package ships both — this shows neither is compulsory.
- **Its own everything else.** Theme tokens are overridden as plain custom properties on `.vam-root`; three locale
  strings are renamed; the legend is a `MapWindow` in the `#windows` slot.

Right-click a node for the custom menu, press Edit for the custom form, and drag from the dots on a shape's sides to
draw a cable.

<LiveDemo :source="fullyCustomSource" height="640px">
  <FullyCustomMap />
</LiveDemo>

The node and edge components live beside it, in
[`demos/custom/`](https://github.com/LegionLiner/vue-asset-map/tree/main/docs/.vitepress/demos/custom).

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
import fullyCustomSource from '../.vitepress/demos/FullyCustomMap.vue?raw'
</script>
