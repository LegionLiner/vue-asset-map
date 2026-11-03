# Collapse

Collapsing folds siblings of one type into a single group node and re-routes their edges onto it. Fourteen containers
on one hypervisor, for instance, turn into a single node with a count instead of fourteen separate circles.

```ts
interface CollapseRule {
  threshold?: number
  groupBy?: (entity: AssetEntity) => string | null
  shouldCollapse?: (parentId: EntityId | null, children: readonly AssetEntity[]) => boolean
  pageSize?: number
}
```

By default children are bucketed by `type` and a bucket collapses once it holds more than ten of them.

```vue
<AssetMap :entities="entities" :links="links" :collapse="{ threshold: 4 }" />
```

`:collapse="false"` turns it off entirely.

<LiveDemo :source="collapsedSource">
  <CollapsedGroupMap />
</LiveDemo>

## Collapse guarantees

Collapsing runs **before** layout: positions are computed on the collapsed graph, so a group node does not land in
space laid out for separate nodes. The function is pure and deterministic: group, node and edge order all follow the
order of the input arrays, so the same input gives the same map.

The rest of the invariants:

- **Grouping happens under the nearest _visible_ ancestor.** When a projection hides a parent, its children group one
  level up rather than under a hidden id.
- **Groups never nest.** Levels are walked top-down and a collapsed level is not descended into.
- **Expanding by hand always wins.** `expandedIds` is checked before the rule, so it beats both `shouldCollapse` and
  the threshold.
- **A group of one is never created.** It would hide a node behind a node and save nothing; this floor outranks
  `shouldCollapse`.
- **Genuine multiplicity stays visible.** Parallel edges aggregate only when at least one end is a group.
- **Edges inside a group are not drawn.** They are counted in `CollapsedGroup.internalLinkCount` instead, so a group
  can show how much traffic is internal.

## Expanding a large group

An expanded group puts its members on the map a page at a time — `pageSize`, 200 by default. The rest wait in a
"more" node labelled with how many are left; opening it reveals the next page. Unfolding a group of twelve thousand
used to mount twelve thousand nodes in one go and freeze the tab for a minute.

The "more" node is an ordinary group with `remainderOf` (the group it belongs to) and `offset` (how many members are
already shown) set, and an id of `<groupId>@more:<offset>`. Opening it adds that id to `v-model:expanded`, so how far a
group has been paged survives the same way the rest of the expansion state does. Folding the group again forgets its
pages too. `pageSize: 0` reveals everything at once, as before.

## Custom bucketing

`groupBy` returns the bucket key, or `null` to keep an entity out of any group:

```ts
const collapse = {
  threshold: 6,
  // Group by subnet instead of type, and never fold critical assets away.
  groupBy: (entity) => (entity.meta?.severity === 'critical' ? null : (entity.meta?.subnet ?? entity.type)),
}
```

`shouldCollapse` replaces the threshold decision entirely:

```ts
const collapse = {
  shouldCollapse: (parentId, children) => parentId !== null && children.length > 3,
}
```

## Controlling the state

```vue
<AssetMap v-model:expanded="expanded" :entities="entities" :links="links" />
```

`expanded` is a `Set<string>` of group ids. The component never mutates it in place — a new `Set` goes out on every
change, because the one you passed may come from a store that does not track mutations.

Group ids have the form `group:<parentId>:<bucket>`, and `groupIdFor` builds them:

```ts
import { groupIdFor } from 'vue-asset-map/core'

expanded.value = new Set([groupIdFor('pve-beelink', 'container')])
```

## Events

```vue
<AssetMap
  :entities="entities"
  :links="links"
  @expand="({ groupId, group }) => console.log('opened', groupId, group?.memberIds.length)"
  @collapse="({ groupId }) => console.log('closed', groupId)"
/>
```

## Subtree collapse vs. group collapse

The button on a node hides its **descendants** while the node itself stays on the map. Group collapse hides
**siblings** behind a synthetic node. They compose: a subtree hidden by the button is resolved before any grouping
decision, so its descendants neither group nor reach the node list.

The subtree state is `v-model:collapsedNodes`, a set of ids, so it can be restored or driven from elsewhere. Hiding
the button with `showNodeToggle: false` leaves that binding as the only way in, which is exactly what a design without
the button wants.

<script setup>
import collapsedSource from '../.vitepress/demos/CollapsedGroupMap.vue?raw'
</script>
