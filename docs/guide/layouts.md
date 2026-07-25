# Layouts

A layout engine turns the collapsed graph into positions. Two ship in the package, a third behind a subpath, and any
object with a `run` method can replace them.

<LiveDemo :source="layoutSource">
  <LayoutMap />
</LiveDemo>

## Built-in engines

### manual

Pinned positions are kept untouched, everything else goes into a deterministic grid. The point is not to look good but
to lose no coordinates — this is the engine to use when positions come from a backend.

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

<script setup>
import layoutSource from '../.vitepress/demos/LayoutMap.vue?raw'
</script>
