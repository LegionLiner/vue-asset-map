# Edges

An edge is a bezier curve between two node centres, styled by a class derived from `link.kind`. Colors live in theme
tokens rather than in an inline `stroke`, so an edge recolors itself when the theme switches.

## Kinds and direction

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'cloudflare', target: 'nginx', layers: ['physical'], kind: 'dashed', directed: true },
]
```

`kind` lands in the class `vam-edge--kind-{kind}`, which you can style from your own CSS. `directed` adds an arrow head
and constrains direction-aware traversals — see [Traversal](./traversal).

<LiveDemo :source="edgeKindSource">
  <EdgeKindMap />
</LiveDemo>

## Labels

A link's own `label` is drawn when there is one. Aggregated edges — the ones produced by
[group collapse](./collapse) — fall back to a count. Below the LOD threshold no labels are drawn at all.

The `#edge-label` slot replaces the rendering:

```vue
<template #edge-label="{ link, aggregated, count }">
  <span class="edge-label">{{ aggregated ? `${count} links` : link?.meta?.bandwidth }}</span>
</template>
```

## Parallel links are preserved

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

Register a component under a `kind`, the same way as with nodes:

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
