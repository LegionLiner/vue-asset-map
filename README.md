# vue-asset-map

[Русский](./README.ru.md)

Interactive infrastructure asset map for Vue 3, built on Vue Flow.

[![npm version](https://img.shields.io/npm/v/vue-asset-map.svg)](https://www.npmjs.com/package/vue-asset-map)
[![license](https://img.shields.io/npm/l/vue-asset-map.svg)](./LICENSE)

[Documentation](https://LegionLiner.github.io/vue-asset-map/) ·
[Live demo](https://LegionLiner.github.io/vue-asset-map/examples/) ·
[Changelog](./CHANGELOG.md)

## Features

- **Projections of one graph.** Entities and links are declared once; each view keeps the links whose `layers` name it,
  so the same data renders as a physical topology or as a VPN overlay without a second dataset.
- **Group collapse.** Siblings of one type fold into a single node once they pass a threshold; their edges are
  re-routed onto the group and parallel ones aggregate with a count. A click expands the group back.
- **Subtree collapse.** A button on a node hides its descendants and re-homes their edges onto the node itself.
- **Search by name, IPv4 wildcard and CIDR.** `10.38.24.*` and `10.38.24.0/24` match addresses inside any label or
  sublabel; anything else is a case-insensitive substring.
- **Facet filters.** Groups such as "Subnet" or "Severity" are declared by the consumer through `valuesOf`. Counts are
  computed over the current projection, so picking one value does not zero the other counters.
- **Membership markers.** Dots under a label show which hubs a node connects to, derived from the graph itself.
  Hovering one highlights every node carrying it and dims the rest.
- **Details in draggable windows.** Several stay open at once, capped by a prop, and are filled through the `#details`
  slot. Title, heading and tabs are each replaceable or removable, so nothing of the default design need survive but the
  title bar. `<MapWindow>` is exported so you can build windows of your own.
- **Automatic path tracing.** With `autoPath` and two nodes selected, the route between them is found and highlighted on
  its own and arrives through `path-change`. Shift-click builds the pair up and opens no window while doing it.
- **A node design you can take apart.** The status dot, the fold button, the label plate and the sublabels each switch
  off with a prop or swap out through a slot; `nodeTypes` replaces the node wholesale.
- **Connection kinds and a legend.** `linkTypes` declares colour, dash and name once; it drives the edge stroke, the
  legend and the type select when a link is edited, so the three cannot disagree.
- **Editing, without owning the data.** An edit button turns a details window into a form, right-click menus delete
  behind the package's own confirmation, and links are drawn by dragging between nodes. The map never writes to
  `entities` or `links` — it reports through events and the application decides.
- **A layout you can save.** Dragged positions leave through `v-model:positions` — a plain, serialisable object of
  only the deliberate moves, so a stored arrangement survives the data changing under it. `getPositions()` snapshots
  every node when you want the whole picture.
- **Pluggable layouts.** `manual` and `radial` are built in, `dagre` ships behind a subpath. Any object with
  `run(graph, options, signal)` can be passed instead, and `createWorkerLayout` runs one in a Web Worker.
- **Built for large maps.** Past a few hundred nodes the map culls to the viewport with a spatial index of its own,
  draws dots on a canvas when zoomed out, opens big groups a page at a time and lays out again only when the structure
  changes. `updateEntity` edits one record without a new array.
- **Framework-free core.** `vue-asset-map/core` imports neither Vue nor Vue Flow, so projections, filtering and blast
  radius can be computed on the server.

## Installation

```bash
npm install vue-asset-map vue @vue-flow/core
```

`vue` and `@vue-flow/core` are peer dependencies. Vue Flow must appear exactly once in the dependency tree: it works
through `provide`/`inject`, and a second copy breaks the provider context.

The dagre layout is optional and only needed if you use it:

```bash
npm install @dagrejs/dagre
```

Both stylesheets are imported by the application — Vue Flow's structural CSS and this package's tokens:

```ts
import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'
```

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import type { AssetEntity, AssetLink, AssetView } from 'vue-asset-map'

const entities: AssetEntity[] = [
  { id: 'internet', type: 'cloud', label: 'Internet' },
  { id: 'router', type: 'router', label: 'Office router', parentId: 'internet', sublabels: ['10.0.0.1'] },
  { id: 'vpn', type: 'vps', label: 'VPN coordinator', parentId: 'internet', status: 'online' },
  { id: 'laptop', type: 'host', label: 'Laptop', parentId: 'router', sublabels: ['10.0.0.14'] },
]

const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'internet', target: 'vpn', layers: ['physical'] },
  { id: 'l3', source: 'router', target: 'laptop', layers: ['physical'] },
  { id: 'l4', source: 'vpn', target: 'laptop', layers: ['logical'] },
]

const views: AssetView[] = [
  { id: 'physical', label: 'Physical', hideIsolated: true },
  { id: 'logical', label: 'VPN overlay', hideIsolated: true },
]

const view = ref('physical')
const selection = ref<string[]>([])
</script>

<template>
  <AssetMap
    v-model:view="view"
    v-model:selection="selection"
    :entities="entities"
    :links="links"
    :views="views"
    style="height: 100vh"
  />
</template>
```

A link belongs to a view when its `layers` contain the view id, so `l4` shows up only in the VPN overlay. With
`hideIsolated`, nodes left without links in a view are dropped from it.

## Props

The ones reached for most often; the full list is in the
[API reference](https://LegionLiner.github.io/vue-asset-map/api/).

| Prop                | Type                              | Default        | Description                                               |
| ------------------- | --------------------------------- | -------------- | --------------------------------------------------------- |
| `entities`          | `AssetEntity<E>[]`                | —              | Nodes. Never mutated by the map.                          |
| `links`             | `AssetLink<L>[]`                  | —              | Edges. Never mutated by the map.                          |
| `views`             | `AssetView[]`                     | —              | Projections. Without them everything is drawn.            |
| `layout`            | `AssetMapLayoutSpec`              | `manual`       | Engine by name or as an instance, plus its options.       |
| `collapse`          | `CollapseRule \| false`           | threshold `10` | `false` turns group collapsing off.                       |
| `themeConfig`       | `ThemeConfig`                     | —              | `statusColors` and `kindIcons`, keyed by your own values. |
| `theme`             | `'light' \| 'dark' \| 'auto'`     | `'light'`      | `'auto'` reads the OS setting once.                       |
| `markers`           | `NodeMarkerDef[]`                 | —              | Membership dots under the labels.                         |
| `maxDetailsWindows` | `number`                          | `2`            | `0` disables the details windows.                         |
| `detailsTabs`       | `DetailsTabDef[] \| false`        | built-in tabs  | Tabs of a details window; `false` removes the strip.      |
| `showNodeStatus`    | `boolean`                         | `true`         | `false` removes the status dot from every node.           |
| `maxSublabels`      | `number`                          | unlimited      | Caps the sublabel lines; `0` hides them.                  |
| `autoPath`          | `boolean`                         | `false`        | Trace the path between two selected nodes on its own.     |
| `linkTypes`         | `LinkTypeDef[]`                   | —              | Connection kinds: colour, dash, name.                     |
| `showLegend`        | `boolean`                         | `false`        | Connection legend, bottom-left.                           |
| `showContextMenu`   | `boolean`                         | `false`        | Menu on right-click, over nodes and edges.                |
| `editable`          | `boolean`                         | `false`        | Edit button, delete items, link drawing.                  |
| `detailsMode`       | `'replace'                        | 'stack'`       | `'replace'`                                               | What a plain click does to the open windows. |
| `locale`            | `string \| PartialLocaleMessages` | `ru`           | Locale code, or a dictionary of overrides.                |
| `autoFitView`       | `boolean`                         | `false`        | Fit the canvas to its content after every layout.         |

Two-way bindings: `view`, `selection`, `expanded`, `filters`, `viewport`, `positions`, `openDetails`, `openLinks`,
`collapsedNodes`, `openFilterGroups`. Each works without a `v-model` too — the component then owns that state itself.

## Events

| Event                 | Payload                        | Fired when                                                      |
| --------------------- | ------------------------------ | --------------------------------------------------------------- |
| `node-click`          | `{ id, entity, group, event }` | A node or a group node is clicked.                              |
| `selection-change`    | `EntityId[]`                   | The selection changes, in selection order.                      |
| `path-change`         | `EntityId[]`                   | The traced path changes; empty when the highlight was dropped.  |
| `expand` / `collapse` | `{ groupId, group }`           | A collapsed group is opened or closed.                          |
| `layout-done`         | `{ engine, positions }`        | A layout run finished and was applied.                          |
| `error`               | `unknown`                      | A layout engine threw, or an unknown engine name was requested. |

## Slots

| Slot                             | Props                            | Purpose                                   |
| -------------------------------- | -------------------------------- | ----------------------------------------- |
| `details`                        | `{ entity, close, tab }`         | Body of a details window.                 |
| `details-title` / `details-tabs` | `{ entity, … }`                  | Caption and tab strip of the window.      |
| `node-{type}`                    | `{ entity, nodeId, simplified }` | Replaces the contents of a node circle.   |
| `node-label` / `node-status`     | `{ entity, nodeId, simplified }` | Replaces the label plate or status dot.   |
| `toolbar-left` / `toolbar-right` | —                                | Your own controls in the map header.      |
| `windows`                        | —                                | Custom floating windows above the canvas. |
| `edge-label`                     | `{ link, aggregated, count }`    | Replaces an edge label.                   |

## Requirements

|                             | Version   |
| --------------------------- | --------- |
| Vue                         | `^3.4.0`  |
| Vue Flow (`@vue-flow/core`) | `^1.42.0` |
| Node, to build from source  | `>=20`    |

The package is ESM-only, and its type declarations target `moduleResolution: "bundler"` — the default of a Vite or
webpack project.

## License

[MIT](./LICENSE) © Dmitriy Korolev
