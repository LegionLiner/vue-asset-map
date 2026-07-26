# Search and filters

Search and filter groups narrow one set together: an entity matches when it passes the text query **and** the kind
group **and** the status group **and** every consumer-defined group **and** the custom predicate.

<LiveDemo :source="searchSource">
  <SearchMap />
</LiveDemo>

## Search modes

The query itself picks the mode:

| Query                                    | Mode                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `10.38.24.0/24`                          | CIDR — addresses inside labels and sublabels tested against the range      |
| `10.38.24.*`, `10.38.*.*`, `10.38.24.7*` | Wildcard — matched on the textual form, so `.7*` finds both `.7` and `.70` |
| `beelink`                                | Case-insensitive substring                                                 |

The CIDR base may be any address inside the network: `10.38.24.5/24` is the same range as `10.38.24.0/24`.

Which fields are searched is up to you:

```ts
const filterOptions = {
  searchFields: (entity) => [entity.label, entity.meta?.fqdn ?? '', ...(entity.sublabels ?? [])],
}
```

The default is the label plus every sublabel.

## Matches and the visible area

`applyFilters` returns two sets:

- `matchedIds` — direct hits, the ones highlighted;
- `visibleIds` — everything left on the map: hits, plus neighbours within `neighborDepth` steps, plus ancestor chains
  unless `keepPathToRoot` is off.

Neighbours and the path to the root keep the graph connected around the matches. A node out of scope is not shown, and
it cannot bridge to the next step of a traversal either.

```ts
const filterOptions = {
  neighborDepth: 2,
  keepPathToRoot: true,
  layers: ['physical'],
}
```

While no criterion is active, `matchedIds` is empty and the whole graph is visible: there is nothing to highlight yet.

## Custom filter groups

The package does not know what a "subnet" or a "severity" is. Declare the groups and how to read their values off an
entity:

```ts
import type { FilterGroupDef } from 'vue-asset-map'

const filterGroups: FilterGroupDef[] = [
  {
    id: 'subnet',
    label: 'Subnet',
    valuesOf: (entity) => (entity.meta?.subnet ? [entity.meta.subnet] : []),
    options: [
      { value: 'internet', label: 'Internet' },
      { value: 'vpn', label: 'VPN' },
      { value: 'docker', label: 'Docker bridge' },
    ],
  },
  {
    id: 'severity',
    label: 'Severity',
    valuesOf: (entity) => (entity.meta?.severity ? [entity.meta.severity] : []),
    options: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    defaultOpen: false,
  },
]
```

```vue
<AssetMap :entities="entities" :links="links" :filter-options="{ groups: filterGroups }" />
```

`options` fixes the order and the captions — here severity runs from critical down rather than alphabetically. Omit it
and the values are collected from the data instead.

Values inside one group combine with OR (picking "critical" and "high" shows both); groups combine with AND.

## Filter group counters

Counters are computed over the current **projection**, not over the filter result. Picking `offline` would otherwise
zero every other counter and leave nowhere to go back to.

Values declared explicitly in `options` are reported even at zero, so the list does not jump around while you click.

## Controlling the state

```vue
<AssetMap
  v-model:filters="filters"
  v-model:open-filter-groups="openFilterGroups"
  :entities="entities"
  :links="links"
  :filter-options="{ groups: filterGroups }"
/>
```

```ts
import { emptyFilterState } from 'vue-asset-map'

const filters = ref(emptyFilterState())
const openFilterGroups = ref<string[]>(['subnet'])
```

Which groups are expanded is component state, not `localStorage`: the package never writes to browser storage.
Persisting it across sessions is the application's decision, and `v-model:open-filter-groups` is how it gets out.

## Debouncing

The text query is debounced by `searchDebounce` (200 ms by default). Clicking a filter value applies immediately,
since a click is a single deliberate act that does not need delaying. Clearing the field also applies at once.

Layout ignores the filter: search hides and highlights nodes but never rebuilds the map. Otherwise the graph would
jump on every keystroke.

<script setup>
import searchSource from '../.vitepress/demos/SearchMap.vue?raw'
</script>
