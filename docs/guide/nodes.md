# Nodes

A node is a circle with an icon, with a plate under it carrying the label and the entity's sublabels. Root entities are
drawn at 60 px, children at 36 px. That is the only visual cue for depth, not a field in your data.

Every part of that is optional. Nothing in the design is load-bearing: the status dot, the collapse button, the label
plate and the sublabels can each be switched off with a prop or replaced through a slot, and a design that shares none
of this structure is a `nodeTypes` entry instead. The sections below go from the smallest change to the largest.

## Icons by type

The package knows no types, so it ships no icons. Map them yourself:

```vue
<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import CloudIcon from './icons/CloudIcon.vue'
import RouterIcon from './icons/RouterIcon.vue'

const kindIcons = { cloud: CloudIcon, router: RouterIcon }
</script>

<template>
  <AssetMap :entities="entities" :links="links" :theme-config="{ kindIcons }" />
</template>
```

Draw icons with `currentColor` for strokes and fills. An icon with a baked-in color ignores both a theme switch and
your own token overrides. A type with no icon falls back to the first two characters of the type name.

## Status dot

`status` is an open string. It becomes a colored dot in the top-right corner of the circle through `statusColors`:

```ts
const statusColors = {
  online: 'var(--vam-status-online)',
  offline: '#cb5555',
  degraded: '#e0a800',
}
```

Both a token reference and a literal color work. Referencing a token means the dot follows the theme.

`showNodeStatus: false` removes the dot — the "online / offline" indicator — from every node:

```vue
<AssetMap :entities="entities" :links="links" :show-node-status="false" />
```

The value stays in the data: details windows and filters still see `status`, only this indicator is gone. To draw it
differently rather than remove it, use `#node-status`:

```vue
<template #node-status="{ status, statusColor }">
  <span class="my-status" :style="{ background: statusColor }">{{ status }}</span>
</template>
```

The slot is rendered in the dot's place, inside the circle. `showNodeStatus: false` wins over it — "remove the
indicator" should not have to be said twice.

## Sublabels

`sublabels` is a plain array with no length limit of the package's own: an entity with six sublabels draws six lines and
the plate grows to fit. Two is simply what the sample data carries.

`maxSublabels` caps them when an even node height matters more than completeness — the tail is what gets dropped, since
the first lines are the important ones:

```vue
<AssetMap :entities="entities" :links="links" :max-sublabels="2" />
```

`0` removes sublabels entirely, leaving the label. A view can also switch them off for every node at once with
`showSublabels: false`, which outranks `maxSublabels`.

`showNodeLabel: false` removes the whole plate, label included, leaving the circle alone on the canvas:

```vue
<AssetMap :entities="entities" :links="links" :show-node-label="false" />
```

Layout still reserves the plate's height, so switching it off does not reshape the map.

`#node-label` replaces the plate instead of removing it. It receives the sublabels already narrowed by the view and by
`maxSublabels`, so the slot does not reimplement those rules:

```vue
<template #node-label="{ entity, sublabels }">
  <div class="my-plate">
    <b>{{ entity?.label }}</b>
    <small v-for="line in sublabels" :key="line">{{ line }}</small>
  </div>
</template>
```

## Hiding the collapse button

`showNodeToggle: false` removes the fold button from every node. The subtree state itself is untouched — it is still
driveable through `v-model:collapsed-nodes`, which is how a design without the button folds things:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  v-model:collapsed-nodes="collapsedNodes"
  :show-node-toggle="false"
/>
```

## Replacing the contents of a circle

The `#node-{type}` slot replaces what is inside the circle for one type, leaving the plate, the status dot and the
collapse button in place:

```vue
<AssetMap :entities="entities" :links="links">
  <template #node-workstation="{ entity, nodeId, simplified }">
    <span :title="entity?.label">{{ simplified ? '·' : entity?.label?.slice(0, 2) }}</span>
  </template>
</AssetMap>
```

`simplified` is `true` below the LOD threshold, when the map draws circles only. Honour it — the slot content is
rendered for every node on screen.

<LiveDemo :source="customNodeSource">
  <CustomNodeMap />
</LiveDemo>

## Replacing the whole node

For full control, register a component under a type. It receives `id` and `data` from Vue Flow and reads everything
else from the map context:

```vue
<!-- RouterNode.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetNodeData } from 'vue-asset-map'

const props = defineProps<{ id: string; data?: AssetNodeData }>()
const map = useMapContext()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))
</script>

<template>
  <div class="router-node" :class="{ selected: map.isSelected(id) }" @click="map.onNodeClick(id, $event)">
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />
    {{ entity?.label }}
  </div>
</template>
```

```vue
<AssetMap :entities="entities" :links="links" :node-types="{ router: RouterNode }" />
```

`useMapContext()` throws a legible error outside `<AssetMap>`, so a component rendered in the wrong place says so
instead of failing deep inside a render.

Interactions go through the context (`onNodeClick`, `onNodeDoubleClick`, `onNodeContextMenu`) rather than through Vue
Flow events. That keeps behaviour identical whether or not Vue Flow's own selection is enabled.

## Collapsing a subtree

A node with descendants gets a button in its top-right corner. Pressing it hides the whole subtree and re-homes the
descendants' edges onto the node, the same way a group node collects the edges of its members.

The state is a set of ids and can be controlled:

```vue
<AssetMap v-model:collapsed-nodes="collapsedNodes" :entities="entities" :links="links" />
```

## Badges

```ts
{ id: 'ws-1', type: 'workstation', label: 'Workstation', badges: [{ id: 'cve', color: '#cb5555', tooltip: '3 CVEs' }] }
```

Badges render under the plate. `#node-badge` replaces their rendering:

```vue
<template #node-badge="{ badge, entity }">
  <span class="my-badge">{{ badge?.id }} · {{ entity?.label }}</span>
</template>
```

<script setup>
import customNodeSource from '../.vitepress/demos/CustomNodeMap.vue?raw'
</script>
