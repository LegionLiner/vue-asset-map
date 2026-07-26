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

## Replacing the whole design

A details window is four parts stacked: the title bar (`.vam-window__header`), the heading block
(`.vam-window__heading`), the tab strip (`.vam-window__tabs`) and the body (`.vam-window__content`). Everything below
the title bar can be replaced or removed outright, so nothing of the package's design has to survive but the bar:

| Part          | Change it         | Remove it                   |
| ------------- | ----------------- | --------------------------- |
| Title bar     | `detailsTitle`    | —                           |
| Bar caption   | `#details-title`  | —                           |
| Heading block | `#details-header` | `showDetailsHeading: false` |
| Tab strip     | `#details-tabs`   | `detailsTabs: false`        |
| Tabs shown    | `detailsTabs`     | —                           |
| Body          | `#details`        | —                           |

The window's own title is `entity.label` by default. `detailsTitle` changes it — a string, or a function of the entity:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :details-title="(entity) => `${entity.type.toUpperCase()} · ${entity.label}`"
/>
```

`#details-title` takes over the caption with markup rather than a string, and receives the window's `collapsed` state
along with the entity:

```vue
<template #details-title="{ entity, collapsed }">
  <b>{{ entity.label }}</b>
  <small v-if="!collapsed">{{ entity.type }}</small>
</template>
```

`#details-header` replaces the heading block below the bar — the large label with the type and status line.
`showDetailsHeading: false` removes it instead.

All of it together leaves the title bar and nothing else of the default design:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  details-title="Asset card"
  :show-details-heading="false"
  :details-tabs="[{ id: 'risk', label: 'Risks' }]"
>
  <template #details-tabs="{ tabs, active, select }">
    <nav class="my-tabs">
      <button v-for="tab in tabs" :key="tab.id" :class="{ on: tab.id === active }" @click="select(tab.id)">
        {{ tab.label }}
      </button>
    </nav>
  </template>
  <template #details="{ entity, tab }">
    <MyPanel :entity="entity" :tab="tab" />
  </template>
</AssetMap>
```

The bar itself stays: it carries the dragging, collapsing and closing that make the thing a window. To build a window
whose bar is yours too, use `MapWindow` in the `#windows` slot — see below.

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

The default panel has an overview tab and a links tab. The active tab id reaches the `#details` slot as `tab`, so a
custom panel can render different content per tab. It is never reset when the entity changes — the map keys its windows
by entity id, so a different entity is a different component instance with default state.

`detailsTabs` replaces the pair with tabs of your own. `label` is a finished string, not a locale key: your tabs are
yours, and the package's dictionary knows nothing about them. The first entry is the one open at first.

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :details-tabs="[
    { id: 'risk', label: 'Risks' },
    { id: 'audit', label: 'Audit' },
  ]"
>
  <template #details="{ entity, tab }">
    <RiskPanel v-if="tab === 'risk'" :entity="entity" />
    <AuditPanel v-else :entity="entity" />
  </template>
</AssetMap>
```

With custom tabs the package draws no body of its own: it has nothing to show under a tab it does not know, and putting
the built-in link list under "Risks" would be a plain lie. Fill `#details` alongside them.

`detailsTabs: false` removes the strip. The built-in body stays — the tabs are gone, not replaced — so a single-page
window needs nothing else.

`#details-tabs` replaces the strip's rendering while keeping its behaviour: the slot receives the tabs, the active id
and a `select` callback.

<script setup>
import detailsSource from '../.vitepress/demos/CustomDetailsMap.vue?raw'
</script>
