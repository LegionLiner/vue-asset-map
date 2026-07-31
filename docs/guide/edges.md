# Edges

An edge is a bezier curve between two node centres. By default it is styled by a class derived from `link.type`, with
colors in theme tokens rather than an inline `stroke`, so it recolors itself when the theme switches. Declaring
[connection kinds](./editing#connection-kinds) replaces that with a colour and dash of your own.

## Kinds and direction

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'cloudflare', target: 'nginx', layers: ['physical'], type: 'dashed', directed: true },
]
```

`type` lands in the class `vam-edge--type-{type}`, which you can style from your own CSS. `directed` adds an arrow head
and constrains direction-aware traversals — see [Traversal](./traversal).

For a colour, a dash and a human name per kind — plus a legend, and a type select when a link is edited — declare
`linkTypes` instead of styling the classes by hand. One declaration drives all three, so they cannot disagree. See
[Connections and editing](./editing#connection-kinds).

<LiveDemo :source="edgeKindSource">
  <EdgeKindMap />
</LiveDemo>

## Clicking an edge

A click opens a window describing the connection: what it joins, its kind, its layers and its `meta`. The open set is
`v-model:openLinks`, and `#link-details` replaces the body. An **aggregated** edge opens nothing — it stands for
several links at once and has no single record to show — though the click still reports through `edge-click`.

Right-click puts a menu on the edge when `showContextMenu` is on, with a delete item while `editable`. All of it is on
[Connections and editing](./editing).

The line itself is 1px, which is not a click target, so every edge also carries an invisible 16px path along the same
route. That is what takes the pointer; without it a click would land on the canvas nine times in ten.

## Attaching to a specific handle

A node that draws more than one handle — ports on a switch, slots in a rack, objects inside a block — can have lines
that join a _specific pair_ rather than the two nodes as wholes:

```ts
{ id: 'l1', source: 'switch-a', target: 'switch-b', layers: ['physical'],
  sourceHandle: 'port-3', targetHandle: 'port-1' }
```

The ids are the `id` props of the `<Handle>` components inside your node. Omitted, a line lands on the node's first
handle of the right type, which is what every single-handle node wants — so nothing changes unless you ask for it.

When a link is drawn by dragging, the handles the user actually connected arrive on the candidate that `link-create`
reports. That is the only moment the information exists: two node ids cannot say which pair was joined.

## Labels

A link's own `label` is drawn when there is one. Aggregated edges — the ones produced by
[group collapse](./collapse) — fall back to a count. Below the LOD threshold no labels are drawn at all.

The `#edge-label` slot replaces the rendering:

```vue
<template #edge-label="{ link, aggregated, count }">
  <span class="edge-label">{{ aggregated ? `${count} links` : link?.meta?.bandwidth }}</span>
</template>
```

## Parallel links

Two links between the same pair with different ids are two edges. That is deliberate: a second uplink to the same
router is a fact about the infrastructure, not a duplicate to be cleaned up.

Aggregation into a single `AggregatedLink` happens only when collapsing puts a group at one end, and then `count` and
`sourceLinkIds` record what went into it:

```ts
import { isAggregatedLink } from 'vue-asset-map/core'

if (isAggregatedLink(link)) {
  console.log(link.count, link.sourceLinkIds)
}
```

## A custom edge component

Register a component under a `type`, the same way as with nodes:

```vue
<!-- TunnelEdge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, getBezierPath, Position } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetEdgeData } from 'vue-asset-map'

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  data?: AssetEdgeData
}>()

defineOptions({ inheritAttrs: false })

const map = useMapContext()

const path = computed(() => {
  const [d] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  })
  return d
})
</script>

<template>
  <BaseEdge :id="id" :path="path" :class="{ dimmed: map.isEdgeDimmed(id) }" />
</template>
```

```vue
<AssetMap :entities="entities" :links="links" :edge-types="{ tunnel: TunnelEdge }" />
```

`defineOptions({ inheritAttrs: false })` is not optional here. Vue Flow passes an edge dozens of props of its own, and
without it Vue logs an "extraneous attributes" warning for every edge on the map.

Dimming and highlighting are decided by the map, not by the edge: the rule depends on the mode — search, selection or
marker hover — and an edge has no business knowing about modes. Read them through `map.isEdgeDimmed(id)`,
`map.isEdgeHighlighted(id)` and `map.isEdgeInfected(id)`.

<script setup>
import edgeKindSource from '../.vitepress/demos/EdgeKindMap.vue?raw'
</script>
