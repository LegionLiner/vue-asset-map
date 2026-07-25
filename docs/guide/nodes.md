# Nodes

A node is a circle with an icon and a fixed-size plate under it carrying the label and up to two sublabels. Root
entities are drawn at 60 px and children at 36 px — the only visual cue for depth, and not a field in your data.

## Icons by kind

The package knows no kinds, so it ships no icons. Map them yourself:

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
your own token overrides. A kind with no icon falls back to the first two characters of the kind name.

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

## Replacing the contents of a circle

The `#node-{kind}` slot replaces what is inside the circle for one kind, leaving the plate, the status dot and the
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

For full control, register a component under a kind. It receives `id` and `data` from Vue Flow and reads everything
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
{ id: 'ws-1', kind: 'workstation', label: 'Workstation', badges: [{ id: 'cve', color: '#cb5555', tooltip: '3 CVEs' }] }
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
