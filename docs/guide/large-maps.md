# Large maps

Tens of thousands of entities fit on one map, provided neither the map nor the application does work proportional to
all of them on every small change. The map takes care of its half; this page lists what it does and what is left to
the application.

## What the map does by itself

**Viewport culling.** Past `virtualize` nodes (300 by default) the map keeps a spatial index of its own and hands Vue
Flow only what is on screen plus half a screen of margin — and both ends of any edge crossing it. Node sizes are known
before anything renders, so nothing has to be mounted to find out where it is. Vue Flow's own
`onlyRenderVisibleElements` is switched off meanwhile: a node it has not measured yet is 0×0 to it and counts as
visible, which made the first frame, and every expanded group, mount everything.

**Dots on a canvas when zoomed out.** Below `lodThreshold` a virtualized map draws nodes as dots and links as lines on a
single `<canvas>` (`lodCanvas`, on by default). Colours follow the same rules as the DOM nodes — status, selection,
search hits, dimming, infection — and still come from the `--vam-*` tokens. A click on a dot selects the node and opens
its window; on a group's dot it unfolds the group.

**Groups open a page at a time.** An expanded group shows `pageSize` members (200) and keeps the rest behind a "more"
node. See [Collapse](./collapse#expanding-a-large-group).

**Layout runs only when the structure changes.** A new `entities` array with the same ids and parents in the same
order — a renamed asset, a changed status, a moved one — reuses the graph's indexes and does not lay anything out
again. Adding, removing or re-parenting an entity, or re-pointing a link, does.

**Search prepares each entity once.** Lower-cased fields and the addresses in them are kept alongside the entity, so
only the first query of a session pays for parsing them: a CIDR query over 100 000 entities went from about 160 ms per
keystroke to about 25 ms.

**The overview stays three elements.** Past 500 nodes `MiniMap` draws one path per kind of node rather than a
rectangle each.

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :virtualize="true"
  :lod-threshold="0.4"
  :collapse="{ pageSize: 100 }"
/>
```

## Feeding the map

The map never copies or mutates `entities`; how cheaply it reacts to a change depends on how that change arrives.

- **Keep large datasets out of deep reactivity.** A `ref` over a hundred thousand records proxies every one of them,
  and every field read goes through a proxy. Hold them in a `shallowRef` (or `markRaw` the records) and assign a new
  array when something changes.
- **Edit one record with `updateEntity`.** For a status or a label, call the exposed method with a new object instead
  of building a new array. Nothing is laid out again, nothing is remounted, and an open window shows the change:

  ```ts
  const map = ref<AssetMapExposed<Asset>>()
  map.value?.updateEntity({ ...entity, status: 'offline' })
  ```

  It covers records already on the map, with the same `parentId`. The replacement holds until the next `entities`
  array arrives, so keep your own store in step.

- **Keep positions apart from records.** Bind `v-model:positions` (or listen to `node-move`) and save positions in
  their own request, batched and debounced — not by writing them into the asset and saving the whole record. A drag
  then costs one key in one object rather than a new version of the asset and a new array.
- **Import in one assignment.** Creating a thousand records one by one, each pushed into the store, rebuilds the
  map a thousand times. Build the batch, then assign it once.
- **Look records up by id through a `Map`.** `array.find` inside a loop over neighbours is quadratic on a large
  scheme. `getGraph()` already has `entities`, `adjacency` and `links` indexed by id.

## Layout off the main thread

Dagre refuses graphs past `maxNodes` (2 000) on the main thread. To lay out more, or to keep the tab responsive while
it works, run it in a worker. The worker file is the application's — its bundler is what knows how to emit one:

```ts
// layout.worker.ts
import { exposeLayoutEngine } from 'vue-asset-map/layout-worker'
import { dagreLayout } from 'vue-asset-map/layout-dagre'

exposeLayoutEngine(dagreLayout)
```

```ts
// where the map is
import { createWorkerLayout } from 'vue-asset-map'

const dagreOffThread = createWorkerLayout(
  'dagre',
  () => new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' }),
)

const layout = { engine: dagreOffThread, options: { rankdir: 'LR', maxNodes: 8000 } }
```

The worker is created on the first run and reused. A run the map no longer wants — the view switched, the data changed
— terminates it, since a synchronous engine cannot be stopped any other way; the next run starts a fresh one. Options
have to survive `postMessage`, so they cannot carry functions.

## What culling cannot do

- **A hub on screen brings its neighbours along.** Every edge crossing the viewport is mounted with both ends, so a node
  with ten thousand links mounts ten thousand far ends. Collapse is what keeps such hubs manageable.
- **`fitView` on a virtualized map fits the index, not the DOM.** That is the whole map, as before — it just no longer
  depends on what happens to be mounted.
- **Arrow-key navigation to a culled node pans to it first**, then focuses it once it is mounted.
