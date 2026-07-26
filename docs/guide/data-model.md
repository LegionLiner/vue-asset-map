# Data model

Two arrays describe everything on screen: `entities` and `links`. The map only reads them: no field is added, reordered
or normalised in place.

## AssetEntity

```ts
interface AssetEntity<M = unknown> {
  id: EntityId
  kind: string
  label: string
  sublabels?: string[]
  status?: string
  badges?: Badge[]
  parentId?: EntityId | null
  position?: XY
  meta?: M
}
```

| Field       | Purpose                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`        | Unique across the dataset. Everything else refers to an entity by it.                                                  |
| `kind`      | Selects the icon and the render component. An open string union — any value is valid.                                  |
| `label`     | The name on the plate under the circle.                                                                                |
| `sublabels` | Extra lines under the label: IP, FQDN, domain. The first is drawn in the muted color, the second in the overlay color. |
| `status`    | Mapped to a color through `themeConfig.statusColors`. The package ships no status names.                               |
| `badges`    | Small markers under the plate.                                                                                         |
| `parentId`  | Hierarchy, used by grouping and collapsing. `null` or absent means a root.                                             |
| `position`  | A pinned position in canvas px. Outranks the layout engine.                                                            |
| `meta`      | Your own payload. Marked `markRaw` internally and never made reactive.                                                 |

`meta` is what the details panel renders and what filter groups read through `valuesOf`. Give it a type and it flows
through to the slots:

```ts
interface AssetMeta {
  owner?: string
  subnet?: 'internet' | 'vpn' | 'docker'
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

const entities: AssetEntity<AssetMeta>[] = [
  { id: 'ws-1', kind: 'workstation', label: 'Workstation', meta: { owner: 'Dmitry', severity: 'low' } },
]
```

## AssetLink

```ts
interface AssetLink<M = unknown> {
  id: string
  source: EntityId
  target: EntityId
  layers: string[]
  kind?: string
  label?: string
  directed?: boolean
  meta?: M
}
```

| Field      | Purpose                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| `layers`   | Which projections the link belongs to. See [Views](./views).                                  |
| `kind`     | Selects the edge style through a CSS class, and a custom edge component if one is registered. |
| `directed` | Draws an arrow, and constrains direction-aware traversals such as `blastRadius`.              |

Parallel links between the same pair are kept: two links with different ids are two edges, and the count survives into
aggregation when a group collapses.

## Handling invalid data

`buildGraph` never throws on bad data. It reports through `onIssue` and carries on:

| Situation                               | What happens                                              |
| --------------------------------------- | --------------------------------------------------------- |
| Duplicate entity or link id             | The first occurrence wins.                                |
| Link to a missing entity                | The link is dropped.                                      |
| `parentId` pointing at a missing entity | The node becomes a root.                                  |
| A cycle in the hierarchy                | The parent link is cut at the node that closed the cycle. |
| `parentId` equal to the entity's own id | Treated as a root.                                        |

That matters because asset data usually arrives from inventory systems, where a dangling reference is ordinary, and the
map needs to stay usable with that kind of data:

```ts
import { buildGraph } from 'vue-asset-map/core'

const graph = buildGraph(entities, links, {
  onIssue: (issue) => console.warn(`[asset-map] ${issue.code}: ${issue.id}`, issue.detail),
})
```

## The indexed graph

`buildGraph` returns an `AssetGraph`: the same entities and links plus the indexes everything downstream reads.

```ts
interface AssetGraph<E = unknown, L = unknown> {
  entities: ReadonlyMap<EntityId, AssetEntity<E>>
  links: ReadonlyMap<string, AssetLink<L>>
  adjacency: ReadonlyMap<EntityId, readonly string[]>
  childrenOf: ReadonlyMap<EntityId, readonly EntityId[]>
  roots: readonly EntityId[]
  parentOf: ReadonlyMap<EntityId, EntityId | null>
  outgoing: ReadonlyMap<EntityId, readonly string[]>
  incoming: ReadonlyMap<EntityId, readonly string[]>
}
```

Two details matter here. A self-loop appears in `adjacency` **once**, not twice, so a doubled loop stays distinguishable
from two parallel links. `parentOf` holds the _effective_ parent, already post-repair, so a cycle in the hierarchy
cannot make a traversal hang.

Inside a component you rarely build the graph yourself; the map does it and exposes the result:

```ts
const map = useTemplateRef<AssetMapExposed>('map')
const graph = map.value?.getGraph()
```

Recomputation is tied to the array references. Editing a field inside an existing entity does not rebuild the indexes.
Replace the array to signal a change, the way an immutable store would.
