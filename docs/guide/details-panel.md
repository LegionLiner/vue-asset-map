# Details panel

Clicking a node opens a draggable window. The package fills it minimally — label, type, tabs and a flat list of `meta`
fields — because it knows neither your field names nor which of them matter. Real content goes in the `#details` slot.

<LiveDemo :source="detailsSource">
  <CustomDetailsMap />
</LiveDemo>

## Filling the window

```vue
<script setup lang="ts">
import { AssetMap, DetailsSection } from 'vue-asset-map'

const LABELS = { owner: 'Owner', os: 'OS', cpu: 'vCPU' }
</script>

<template>
  <AssetMap :entities="entities" :links="links">
    <template #details="{ entity, close, tab }">
      <DetailsSection title="Inventory">
        <div v-for="(label, key) in LABELS" :key="key">
          <span>{{ label }}</span>
          <span>{{ entity.meta?.[key] ?? '—' }}</span>
        </div>
      </DetailsSection>
      <button type="button" @click="close">Close</button>
    </template>
  </AssetMap>
</template>
```

`DetailsSection` is exported so a custom panel can be built from the same blocks as the default one, without matching
spacing and typography by eye.

`#details-header` replaces the title bar contents the same way.

## Several windows at once

`maxDetailsWindows` caps how many stay open; the default is `2`, and `0` disables windows entirely without removing
the rest of the UI. Once the limit is reached, opening another closes the oldest — silently ignoring the click would
read as the map not responding.

A window can also be collapsed to its title bar instead of closed. `Escape` closes the topmost one, one per press.

The set of open windows is state like any other:

```vue
<AssetMap v-model:open-details="openDetails" :entities="entities" :links="links" />
```

## Windows of your own

`MapWindow` is exported: a title bar, dragging, collapsing and closing, with positioning left to the caller.

```vue
<script setup lang="ts">
import { AssetMap, MapWindow } from 'vue-asset-map'
</script>

<template>
  <AssetMap :entities="entities" :links="links">
    <template #windows>
      <MapWindow
        title="History"
        :closable="false"
        :collapsible="false"
        drag-handle
        header-only
        :style="{ position: 'absolute', top: '16px', right: '16px' }"
      >
        <template #header>
          <button type="button">⏮</button>
          <button type="button">⏭</button>
        </template>
      </MapWindow>
    </template>
  </AssetMap>
</template>
```

| Prop          | Default | Purpose                                                       |
| ------------- | ------- | ------------------------------------------------------------- |
| `title`       | —       | Caption centred in the bar.                                   |
| `closable`    | `true`  | `false` for windows that must stay.                           |
| `collapsible` | `true`  | Show the collapse-to-bar button.                              |
| `headerOnly`  | `false` | Render the bar only, with no body.                            |
| `dragHandle`  | `false` | Show a drag handle — needed by windows without a caption.     |
| `offset`      | —       | Starting offset in px, to keep windows from stacking exactly. |

Windows in the `#windows` slot render above the details windows, and the details windows measure them and start
below — a newly opened one does not cover your history strip. Both drop below the toolbar when `#toolbar-right` has
anything in it, so the application's own buttons stay clickable.

Interactive elements inside a title bar are not drag handles: buttons, links and inputs get their clicks. Without that
exception the close and collapse buttons would not work at all, because `preventDefault()` on `pointerdown` stops the
browser synthesising a `click`.

## Tabs

The default panel has an overview tab and a links tab. The active tab id reaches the slot as `tab`, so a custom panel
can render different content per tab. It is never reset when the entity changes — the map keys its windows by entity
id, so a different entity is a different component instance with default state.

<script setup>
import detailsSource from '../.vitepress/demos/CustomDetailsMap.vue?raw'
</script>
