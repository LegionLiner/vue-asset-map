# Getting started

## Install

```bash
npm install vue-asset-map vue @vue-flow/core
```

`vue` and `@vue-flow/core` are peer dependencies. Vue Flow must appear exactly once in the dependency tree — it works
through `provide`/`inject`, and a second copy breaks the provider context.

The dagre layout is optional and only pulled in if you import it:

```bash
npm install @dagrejs/dagre
```

## Import the styles

Two stylesheets are needed, and the application imports both. Vue Flow ships the structural CSS for the canvas; this
package ships its tokens and component rules.

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'

import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'

createApp(App).mount('#app')
```

The package never imports CSS from JavaScript. That keeps the module loadable in plain Node (server-side rendering
without a bundler) and leaves the cascade order under your control.

## A first map

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import type { AssetEntity, AssetLink, AssetView } from 'vue-asset-map'

const entities: AssetEntity[] = [
  { id: 'internet', kind: 'cloud', label: 'Internet' },
  { id: 'router', kind: 'router', label: 'Office router', parentId: 'internet', sublabels: ['10.0.0.1'] },
  { id: 'vpn', kind: 'vps', label: 'VPN coordinator', parentId: 'internet', status: 'online' },
  { id: 'laptop', kind: 'host', label: 'Laptop', parentId: 'router', sublabels: ['10.0.0.14'] },
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

Three things are worth noting in that snippet.

**The map fills its container.** It has no height of its own, so give it one — `height: 100vh`, a grid cell, anything.

**A link belongs to a view when its `layers` contain the view id.** `l4` is on the `logical` layer only, so it appears
in the VPN overlay and nowhere else. With `hideIsolated`, a node left without links in a view drops out of it.

**`v-model` is optional.** Bound, the state is yours; unbound, the component owns it. That holds for `view`,
`selection`, `expanded`, `filters`, `viewport`, `openDetails`, `collapsedNodes` and `openFilterGroups` alike.

## The result

<LiveDemo :source="basicSource">
  <BasicMap />
</LiveDemo>

The demo above runs on a larger fixture and adds icons and a layout engine, which the next pages cover.

## Where to go next

- [Data model](./data-model) — what an entity and a link may carry.
- [Views](./views) — projections, layers and isolated nodes.
- [Nodes](./nodes) — icons, custom node components and slots.
- [Search and filters](./search) — IP search and consumer-defined facets.

<script setup>
import basicSource from '../.vitepress/demos/BasicMap.vue?raw'
</script>
