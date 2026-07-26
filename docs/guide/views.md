# Views

A view is a configuration object that defines a projection of the graph onto the canvas: which entities and links
reach it, and how they are laid out. Views are data: the package ships none of its own and knows no view name in
advance. `physical` and `logical` in these examples are ids you chose.

```ts
interface AssetView {
  id: string
  label: string
  linkFilter?: (link: AssetLink) => boolean
  entityFilter?: (entity: AssetEntity) => boolean
  showSublabels?: boolean
  layout?: { engine: string; options?: unknown }
  hideIsolated?: boolean
}
```

## Filtering by layers

Without a `linkFilter`, a link belongs to a view when its `layers` contain the view id:

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'router', target: 'laptop', layers: ['physical'] },
  { id: 'l2', source: 'vpn', target: 'laptop', layers: ['logical'] },
  { id: 'l3', source: 'internet', target: 'router', layers: ['physical', 'logical'] },
]
```

`l3` is in both views; the other two in one each. One array of links describes several topologies.

## Order of application

The order of projection is fixed and observable:

1. `entityFilter` picks candidate entities.
2. `linkFilter` keeps the links whose **both** ends survived step 1.
3. `hideIsolated` drops entities left without a single visible link.

`hideIsolated` only considers links: an entity without a visible incident link is not drawn. Ancestors do not rescue
descendants, and descendants do not rescue ancestors — the hierarchy plays no part in projection. It belongs to
collapsing, and the filter's `keepPathToRoot` keeps the map connected during search.

## Switching views

```vue
<AssetMap v-model:view="view" :entities="entities" :links="links" :views="views" />
```

The built-in switcher appears in the toolbar as soon as there are two views or more. An unknown or missing view id
falls back to the first view rather than rendering an empty map, so a value persisted from an older configuration
cannot blank the screen.

<LiveDemo :source="projectionsSource">
  <ProjectionsMap />
</LiveDemo>

The counter in that demo is computed by the application, not by the map, using the same core function the map runs
internally:

```ts
import { buildGraph, projectGraph, resolveView } from 'vue-asset-map/core'

const graph = buildGraph(entities, links)
const result = projectGraph(graph, resolveView(views, 'physical'))

result.entityIds.size
result.linkIds.size
```

## View layout

```ts
const views: AssetView[] = [
  { id: 'physical', label: 'Physical', layout: { engine: 'radial', options: { radius: 240 } } },
  { id: 'logical', label: 'VPN overlay', layout: { engine: 'dagre', options: { rankdir: 'LR' } } },
]
```

The `layout` prop on the component outranks the view's own, since props sit closer to the consumer.

## Filters beyond layers

`linkFilter` and `entityFilter` replace the default rule entirely when given:

```ts
const criticalOnly: AssetView = {
  id: 'critical',
  label: 'Critical assets',
  entityFilter: (entity) => entity.meta?.severity === 'critical',
  hideIsolated: false,
}
```

With `hideIsolated: false` the survivors stay on the map even where the filter cut every link between them, which is
usually what you want for a view built on entity properties rather than on topology.

## Sublabels per view

`showSublabels: false` hides the address lines in a view. Node geometry does not change — the label plate is a fixed
size — so switching views does not resize anything or jolt the layout.

<script setup>
import projectionsSource from '../.vitepress/demos/ProjectionsMap.vue?raw'
</script>
