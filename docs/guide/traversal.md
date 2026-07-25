# Traversal

The graph functions live in `vue-asset-map/core`, which imports neither Vue nor Vue Flow. They run in a browser, in a
Node script and on a server alike.

```ts
import { buildGraph, neighbors, findPaths, blastRadius } from 'vue-asset-map/core'

const graph = buildGraph(entities, links)
```

## neighbors

Nodes within `depth` edges of an id:

```ts
neighbors(graph, 'keenetic-1', 1)
neighbors(graph, 'keenetic-1', 2, ['physical'])
```

The node itself is never in the result, not even when a cycle makes it reachable from itself — callers want the
neighbourhood, not its closure.

## findPaths

Simple paths between two nodes:

```ts
const paths = findPaths(graph, 'ws-artjom', 'ws-vlad', {
  maxDepth: 6,
  maxPaths: 10,
  layers: ['logical'],
})
```

Paths are simple — no node repeats — so the walk terminates on any cycle. Result order is deterministic: links are
visited in `adjacency` order, which is the order of the input array.

`maxDepth` is measured in edges, and defaults to 6; `maxPaths` defaults to 10.

## blastRadius

What a node's failure reaches: the node itself plus everything influence spreads to.

```ts
blastRadius(graph, 'vps-tailscale', { direction: 'downstream', maxDepth: 2, layers: ['logical'] })
```

`direction` only constrains **directed** links. An undirected link is walked both ways whatever `direction` says,
because it carries no claim about which end depends on which. That is deliberate: inferring dependency from an
undirected edge would produce confident nonsense.

## Highlighting a path on the map

`highlightPath` takes two entity ids — the demo below gets them from `v-model:selection`, built up by Shift-clicking
two nodes. Shift is the modifier to reach for: it adds to the selection on every platform, whereas Ctrl+click does not
reach a node's click handler at all on macOS, where it is the system's own right-click gesture and is dispatched as a
`contextmenu` event instead of a `click`. Ctrl and Cmd are still honoured for anyone whose muscle memory expects them.

```ts
const map = useTemplateRef<AssetMapExposed>('map')

const hops = map.value?.highlightPath('ws-artjom', 'ws-vlad') ?? []
map.value?.clearHighlight()
```

The search runs on the original graph, restricted to the current view's layers, but the highlight is drawn on the
collapsed one: where a stretch of the path is hidden inside a group, the group node and the edges leading to it light
up instead. Otherwise the path would appear to break off.

<LiveDemo :source="pathSource">
  <PathTraceMap />
</LiveDemo>

## The infection overlay

`blastRadius` also backs the infection overlay: mark entities and the map shows everything they capture.

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :infected="['vps-tailscale']"
  :infection-options="{ direction: 'downstream', maxDepth: 2 }"
/>
```

An edge counts as infected only when **both** ends are. One infected end means the spread did not reach across it —
direction or layer did not allow it — so colouring it would mark the very link the capture did not travel along.

A group node counts as infected when any single member is, or collapsing would conceal the infection.

The colors come from `--vam-infected-bg`, `--vam-infected-border` and `--vam-infected-fg`, and a hand-marked source is
drawn heavier than the nodes it captured.

## Membership markers

Markers are the same idea read at a glance: a dot under a label for every hub a node connects to.

```ts
import { connectionMarkers, topAnchors } from 'vue-asset-map/core'

const markers = connectionMarkers([
  { id: 'keenetic-1', label: 'Office A' },
  { id: 'vps-tailscale', label: 'VPN' },
])
```

A workstation wired to a router physically and joined to the VPN logically gets **two** dots — belonging to one does
not cancel the other. Layers are not restricted by default on purpose: the dots exist to show membership without
switching views, and counting them per view would hide the very link you are looking for.

If the hubs are not known up front, take them by degree:

```ts
const markers = connectionMarkers(topAnchors(graph, 3))
```

<LiveDemo :source="markersSource">
  <MarkersMap />
</LiveDemo>

Hovering a dot highlights every node carrying it and dims the rest, after `markerHoverDelay` (500 ms by default). The
delay keeps a pointer that merely crosses the dots on its way elsewhere from flashing the whole map; keyboard focus
highlights immediately, since focus is already a deliberate act.

## Hierarchy helpers

```ts
import { ancestorsOf, descendantsOf, incidentLinks, otherEnd } from 'vue-asset-map/core'

ancestorsOf(graph, 'ct-web-1')
descendantsOf(graph, 'pve-beelink')
incidentLinks(graph, 'keenetic-1', ['physical'])
```

Both walks are cycle-safe, `descendantsOf` returns depth-first order and excludes the node itself.

<script setup>
import pathSource from '../.vitepress/demos/PathTraceMap.vue?raw'
import markersSource from '../.vitepress/demos/MarkersMap.vue?raw'
</script>
