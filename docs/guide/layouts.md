# Layouts

A layout engine turns the collapsed graph into positions. Two ship in the package, a third behind a subpath, and any
object with a `run` method can replace them.

<LiveDemo :source="layoutSource">
  <LayoutMap />
</LiveDemo>

## Built-in engines

### manual

Pinned positions are kept untouched, everything else goes into a deterministic grid. Use it when positions come from a
backend and the coordinates need to be preserved rather than recomputed.

```ts
{ engine: 'manual', options: { columns: 8, columnGap: 200, rowGap: 140, origin: { x: 0, y: 0 } } }
```

`columnGap` and `rowGap` default to the largest node plus 48 px, so cards of mixed sizes cannot overlap.

### radial

Concentric rings by hop distance from the root, so ring number reads as hop count.

```ts
{ engine: 'radial', options: { rootId: 'internet', radius: 220, ringGap: 180, startAngle: -Math.PI / 2 } }
```

Without `rootId` the node of highest degree becomes the centre. Components unreachable from the root are not dropped:
they get a ring beyond the farthest connected one, which keeps isolated nodes visible.

### dagre

Layered layout, behind its own subpath so the optional dependency stays out of the main bundle:

```bash
npm install @dagrejs/dagre
```

```vue
<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import { dagreLayout } from 'vue-asset-map/layout-dagre'
</script>

<template>
  <AssetMap
    :entities="entities"
    :links="links"
    :layout="{ engine: dagreLayout, options: { rankdir: 'LR', ranksep: 120 } }"
  />
</template>
```

Options pass straight through: `rankdir`, `align`, `nodesep`, `ranksep`, `edgesep`, `ranker`.

## Position priority

Three sources compete, in this order:

1. a position produced by dragging a node,
2. `entity.position` from your data,
3. the engine's output.

The first two are handed to the engine as `pinned`, so the engine leaves them alone rather than moving them and being
corrected afterwards. Dagre cannot fix nodes in place, so its output has the pinned positions re-applied over it —
from outside, behaviour matches every other engine.

## Saving the arrangement

Dragged positions leave through `v-model:positions`, an ordinary object keyed by entity id. Bind it, store what comes
out, hand it back on the next mount, and the map opens exactly as someone left it.

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'

const positions = ref(JSON.parse(localStorage.getItem('layout') ?? '{}'))
watch(positions, (next) => localStorage.setItem('layout', JSON.stringify(next)), { deep: true })
</script>

<template>
  <AssetMap v-model:positions="positions" :entities="entities" :links="links" />
</template>
```

It holds **only the deliberate moves**, not every node's coordinates, and that is what makes a saved arrangement
survive the data changing. An entity added next week is laid out by the engine instead of landing wherever an old file
happened to remember; one that disappears leaves a harmless unused key behind.

A plain object rather than a `Map`, because this is the thing that gets serialised — `JSON.stringify` turns a `Map`
into `{}`.

The map never writes to storage itself. Where the layout lives — `localStorage`, a user profile, a URL — is the
application's decision, exactly as with every other piece of state the map hands out.

### Per-node saving

`node-move` fires once per node as a drag finishes, with the entity alongside the id:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  @node-move="({ id, position }) => api.patchAsset(id, position)"
/>
```

Saving one moved asset is a different request from saving the whole layout, and this saves diffing two objects to work
out which one moved.

### The full picture

`getPositions()` returns **every** visible node's position, engine output included — a snapshot for an export or a
thumbnail, as opposed to the arrangement someone chose:

```ts
const map = useTemplateRef<AssetMapExposed>('map')
const snapshot = map.value?.getPositions()
```

It is keyed by node id, so a folded group reports under the group's own id: its members are not on screen and have no
position to report. The result is a copy, safe to keep and edit.

`resetPositions()` forgets every hand-placed position and hands the map back to the engine.

## Writing an engine

```ts
import type { LayoutEngine } from 'vue-asset-map'
import { applyPinned, throwIfAborted } from 'vue-asset-map'

export const columnsLayout: LayoutEngine<{ gap?: number }> = {
  name: 'columns',
  async run(graph, options, signal) {
    throwIfAborted(signal, 'columns')

    const gap = options?.gap ?? 160
    const positions = new Map<string, { x: number; y: number }>()

    graph.nodes.forEach((node, index) => {
      positions.set(node.id, { x: index * gap, y: 0 })
    })

    return applyPinned(positions, graph.nodes)
  },
}
```

```vue
<AssetMap :entities="entities" :links="links" :layout="{ engine: columnsLayout, options: { gap: 200 } }" />
```

Positions are top-left corners in canvas px, keyed by node id. Nodes left out of the returned map keep their current
position.

**Honour the signal.** Every run aborts the previous one, so a user who switches views three times quickly sees only
the last layout applied. `throwIfAborted` and `yieldAndCheck` are exported for that; a stale result is discarded even
if a third-party engine ignores the signal, but a long engine that never checks will keep burning CPU.

## Registering by name

```vue
<AssetMap :entities="entities" :links="links" :layout="{ engine: 'columns' }" />
```

An unknown engine name is not fatal: the map falls back to `manual` and reports it through the `error` event, because
the name may come from view data — that is, from outside.

```ts
import { builtinLayoutEngines, resolveLayoutEngine } from 'vue-asset-map'

resolveLayoutEngine('radial') // radialLayout
resolveLayoutEngine('columns', { columns: columnsLayout })
```

## Relayout on demand

```ts
const map = useTemplateRef<AssetMapExposed>('map')
await map.value?.relayout()
```

`layout-start`, `layout-done` and `error` report the progress of a run.

## Auto-fit

Without a starting position, an unbound `v-model:viewport` defaults to `{ x: 0, y: 0, zoom: 1 }`, so whatever the
layout placed at the origin ends up in the top-left corner rather than centred.

```vue
<AssetMap :entities="entities" :links="links" auto-fit-view />
```

`autoFitView` fits the canvas to its content once the first layout settles. It fits again after anything reshapes the
layout: a view switch, a group collapse or expand, a layout engine change.

The fit is timed by Vue Flow's own node-measurement signal rather than a fixed delay. So it fires exactly once
dimensions are known, and never centres on a graph that has not finished laying out yet.

It defaults to `false`. An application that manages its own viewport — restoring a saved position or calling `focus`
on a node after load — should not have that logic overridden on every relayout. For a one-off fit instead of a
standing behaviour, call the exposed method directly:

```ts
const map = useTemplateRef<AssetMapExposed>('map')
await map.value?.fitView()
```

<script setup>
import layoutSource from '../.vitepress/demos/LayoutMap.vue?raw'
</script>
